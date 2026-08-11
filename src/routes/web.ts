import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { config } from '../config.js';
import { emailSchema, formatZodErrors, loginSchema, registrationSchema } from '../domain/validation.js';
import { clearSessionCookie, csrfToken, setSessionCookie, verifyCsrf } from '../lib/security.js';
import type { UserRepository } from '../repositories/users.js';
import type { AccessService } from '../services/access.js';
import type { MinecraftService } from '../services/minecraft.js';
import type { SessionService } from '../services/session.js';
import { verifyTurnstile } from '../services/turnstile.js';

interface WebDependencies {
  users: UserRepository;
  access: AccessService;
  sessions: SessionService;
  minecraft: MinecraftService;
}

type FormBody = Record<string, string | undefined>;

export async function webRoutes(app: FastifyInstance, dependencies: WebDependencies): Promise<void> {
  const { users, access, sessions, minecraft } = dependencies;

  app.get('/', async (request, reply) => {
    const currentUser = await sessions.currentUser(request);
    return reply.view('index.ejs', baseView(request, reply, currentUser, {
      title: 'Acesso ao servidor',
      serverAddress: config.minecraftServerAddress,
      minecraftVersion: config.minecraftVersion
    }));
  });

  app.get('/cadastro', async (request, reply) => {
    const currentUser = await sessions.currentUser(request);
    if (currentUser) return reply.redirect('/painel');
    return reply.view('register.ejs', baseView(request, reply, null, {
      title: 'Criar conta', errors: [], values: {}, turnstile: config.turnstile
    }));
  });

  app.post('/cadastro', {
    config: { rateLimit: { max: 5, timeWindow: '15 minutes' } }
  }, async (request, reply) => {
    if (!verifyCsrf(request)) return forbidden(reply);
    const body = request.body as FormBody;
    const parsed = registrationSchema.safeParse({
      email: body.email,
      minecraftUsername: body.minecraftUsername,
      password: body.password,
      passwordConfirmation: body.passwordConfirmation
    });
    const captchaOk = await verifyTurnstile(body['cf-turnstile-response'], request.ip);

    const reservedUsername = parsed.success
      && config.reservedMinecraftUsernames.has(parsed.data.minecraftUsername.toLowerCase());

    if (!parsed.success || !captchaOk || reservedUsername) {
      const errors = parsed.success ? [] : formatZodErrors(parsed.error);
      if (!captchaOk) errors.push('Não foi possível validar que você é uma pessoa. Tente novamente.');
      if (reservedUsername) errors.push('Este nome do Minecraft está reservado.');
      return reply.code(400).view('register.ejs', baseView(request, reply, null, {
        title: 'Criar conta', errors,
        values: { email: body.email ?? '', minecraftUsername: body.minecraftUsername ?? '' },
        turnstile: config.turnstile
      }));
    }

    try {
      await access.register(parsed.data.email, parsed.data.minecraftUsername, parsed.data.password);
      return reply.view('message.ejs', baseView(request, reply, null, {
        title: 'Confira seu e-mail',
        heading: 'Cadastro recebido',
        message: 'Enviamos um link de confirmação. Depois de confirmar, seu nome será liberado automaticamente na whitelist.',
        actionHref: '/login', actionLabel: 'Ir para o login', kind: 'success'
      }));
    } catch (error) {
      const duplicate = isPostgresUniqueViolation(error);
      request.log.error({ error }, 'Falha ao cadastrar jogador');
      return reply.code(duplicate ? 409 : 500).view('register.ejs', baseView(request, reply, null, {
        title: 'Criar conta',
        errors: [duplicate
          ? 'Este e-mail ou nome do Minecraft já está cadastrado.'
          : 'Não foi possível concluir o cadastro agora. Tente novamente.'],
        values: { email: parsed.data.email, minecraftUsername: parsed.data.minecraftUsername },
        turnstile: config.turnstile
      }));
    }
  });

  app.get('/confirmar', async (request, reply) => {
    const query = request.query as { token?: string };
    if (!query.token || query.token.length > 256) {
      return confirmationFailure(request, reply);
    }
    const user = await access.confirm(query.token);
    if (!user) return confirmationFailure(request, reply);

    const automatic = user.whitelist_status === 'whitelisted';
    return reply.view('message.ejs', baseView(request, reply, null, {
      title: 'Cadastro confirmado',
      heading: automatic ? 'Acesso liberado' : 'E-mail confirmado',
      message: automatic
        ? `${user.minecraft_username} já foi adicionado à whitelist. Você pode entrar no servidor.`
        : 'Seu e-mail foi confirmado. A liberação está sendo repetida automaticamente e aparecerá no painel.',
      actionHref: '/login', actionLabel: 'Entrar no painel', kind: automatic ? 'success' : 'warning'
    }));
  });

  app.get('/reenviar-confirmacao', async (request, reply) => {
    return reply.view('resend.ejs', baseView(request, reply, null, {
      title: 'Reenviar confirmação', errors: []
    }));
  });

  app.post('/reenviar-confirmacao', {
    config: { rateLimit: { max: 3, timeWindow: '30 minutes' } }
  }, async (request, reply) => {
    if (!verifyCsrf(request)) return forbidden(reply);
    const body = request.body as FormBody;
    const parsed = emailSchema.safeParse(body.email);
    if (!parsed.success) {
      return reply.code(400).view('resend.ejs', baseView(request, reply, null, {
        title: 'Reenviar confirmação', errors: ['Informe um e-mail válido.']
      }));
    }
    await access.resendVerification(parsed.data);
    return reply.view('message.ejs', baseView(request, reply, null, {
      title: 'Solicitação recebida', heading: 'Verifique seu e-mail',
      message: 'Se existir um cadastro pendente para esse endereço, enviaremos um novo link.',
      actionHref: '/login', actionLabel: 'Voltar ao login', kind: 'success'
    }));
  });

  app.get('/login', async (request, reply) => {
    const currentUser = await sessions.currentUser(request);
    if (currentUser) return reply.redirect('/painel');
    return reply.view('login.ejs', baseView(request, reply, null, {
      title: 'Entrar', errors: [], email: ''
    }));
  });

  app.post('/login', {
    config: { rateLimit: { max: 8, timeWindow: '15 minutes' } }
  }, async (request, reply) => {
    if (!verifyCsrf(request)) return forbidden(reply);
    const body = request.body as FormBody;
    const parsed = loginSchema.safeParse({ email: body.email, password: body.password });
    if (!parsed.success) {
      return reply.code(400).view('login.ejs', baseView(request, reply, null, {
        title: 'Entrar', errors: formatZodErrors(parsed.error), email: body.email ?? ''
      }));
    }
    const authentication = await access.authenticate(parsed.data.email, parsed.data.password);
    if (!authentication) {
      return reply.code(401).view('login.ejs', baseView(request, reply, null, {
        title: 'Entrar',
        errors: ['E-mail ou senha inválidos, cadastro não confirmado ou acesso bloqueado.'],
        email: parsed.data.email
      }));
    }
    setSessionCookie(reply, authentication.token);
    return reply.redirect(authentication.user.role === 'admin' ? '/admin' : '/painel');
  });

  app.post('/logout', async (request, reply) => {
    if (!verifyCsrf(request)) return forbidden(reply);
    await sessions.logout(request);
    clearSessionCookie(reply);
    return reply.redirect('/');
  });

  app.get('/painel', async (request, reply) => {
    const currentUser = await requireUser(request, reply, sessions);
    if (!currentUser) return;
    return reply.view('dashboard.ejs', baseView(request, reply, currentUser, {
      title: 'Meu acesso', user: currentUser,
      serverAddress: config.minecraftServerAddress,
      minecraftVersion: config.minecraftVersion
    }));
  });

  app.get('/admin', async (request, reply) => {
    const currentUser = await requireAdmin(request, reply, sessions);
    if (!currentUser) return;
    let minecraftStatus = 'Indisponível';
    try { minecraftStatus = await minecraft.status(); } catch { /* exibido como indisponível */ }
    return reply.view('admin.ejs', baseView(request, reply, currentUser, {
      title: 'Administração', users: await users.listUsers(), minecraftStatus
    }));
  });

  app.post('/admin/jogadores/:id/bloquear', async (request, reply) => {
    if (!verifyCsrf(request)) return forbidden(reply);
    const currentUser = await requireAdmin(request, reply, sessions);
    if (!currentUser) return;
    const { id } = request.params as { id: string };
    await access.block(currentUser.id, id);
    return reply.redirect('/admin');
  });

  app.post('/admin/jogadores/:id/desbloquear', async (request, reply) => {
    if (!verifyCsrf(request)) return forbidden(reply);
    const currentUser = await requireAdmin(request, reply, sessions);
    if (!currentUser) return;
    const { id } = request.params as { id: string };
    await access.unblock(currentUser.id, id);
    return reply.redirect('/admin');
  });
}

function baseView(
  request: FastifyRequest,
  reply: FastifyReply,
  currentUser: unknown,
  values: Record<string, unknown>
): Record<string, unknown> {
  return {
    ...values,
    appName: config.appName,
    currentUser,
    csrf: csrfToken(request, reply),
    year: new Date().getFullYear()
  };
}

async function requireUser(request: FastifyRequest, reply: FastifyReply, sessions: SessionService) {
  const user = await sessions.currentUser(request);
  if (!user) {
    await reply.redirect('/login');
    return null;
  }
  return user;
}

async function requireAdmin(request: FastifyRequest, reply: FastifyReply, sessions: SessionService) {
  const user = await requireUser(request, reply, sessions);
  if (!user) return null;
  if (user.role !== 'admin') {
    await reply.code(403).view('message.ejs', baseView(request, reply, user, {
      title: 'Acesso negado', heading: 'Acesso restrito',
      message: 'Esta área é exclusiva para administradores.',
      actionHref: '/painel', actionLabel: 'Voltar ao painel', kind: 'error'
    }));
    return null;
  }
  return user;
}

function forbidden(reply: FastifyReply) {
  return reply.code(403).send('Solicitação inválida ou expirada. Atualize a página e tente novamente.');
}

function confirmationFailure(request: FastifyRequest, reply: FastifyReply) {
  return reply.code(400).view('message.ejs', baseView(request, reply, null, {
    title: 'Link inválido', heading: 'Não foi possível confirmar',
    message: 'O link é inválido, já foi utilizado ou expirou.',
    actionHref: '/reenviar-confirmacao', actionLabel: 'Solicitar novo link', kind: 'error'
  }));
}

function isPostgresUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}
