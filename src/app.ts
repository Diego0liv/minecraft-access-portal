import { join } from 'node:path';
import cookie from '@fastify/cookie';
import formbody from '@fastify/formbody';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import view from '@fastify/view';
import Fastify from 'fastify';
import ejs from 'ejs';
import { pool } from './db/pool.js';
import { csrfToken } from './lib/security.js';
import { UserRepository } from './repositories/users.js';
import { webRoutes } from './routes/web.js';
import { AccessService } from './services/access.js';
import { EmailService } from './services/email.js';
import { MinecraftService } from './services/minecraft.js';
import { SessionService } from './services/session.js';

export async function buildApp() {
  const app = Fastify({
    logger: { redact: ['req.headers.cookie', 'req.body.password', 'req.body.passwordConfirmation'] },
    trustProxy: true,
    bodyLimit: 32 * 1024
  });

  await app.register(cookie);
  await app.register(formbody);
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", 'https://challenges.cloudflare.com'],
        frameSrc: ["'self'", 'https://challenges.cloudflare.com'],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'", 'https://challenges.cloudflare.com']
      }
    }
  });
  await app.register(rateLimit, { max: 120, timeWindow: '1 minute' });
  await app.register(fastifyStatic, { root: join(process.cwd(), 'public'), prefix: '/assets/' });
  await app.register(view, { engine: { ejs }, root: join(process.cwd(), 'views') });

  const users = new UserRepository(pool);
  const minecraft = new MinecraftService();
  const access = new AccessService(users, minecraft, new EmailService());
  const sessions = new SessionService(users);

  app.get('/health/live', async () => ({ status: 'ok' }));
  app.get('/health/ready', async (_request, reply) => {
    try {
      await pool.query('SELECT 1');
      return { status: 'ready' };
    } catch {
      return reply.code(503).send({ status: 'not_ready' });
    }
  });

  await app.register(webRoutes, { users, minecraft, access, sessions });

  const reconciliationTimer = setInterval(() => {
    void access.reconcilePending().catch((error) => app.log.error({ error }, 'Falha na reconciliação da whitelist'));
  }, 30_000);
  reconciliationTimer.unref();

  app.addHook('onClose', async () => {
    clearInterval(reconciliationTimer);
    await pool.end();
  });

  app.setNotFoundHandler(async (request, reply) => {
    const currentUser = await sessions.currentUser(request);
    return reply.code(404).view('message.ejs', {
      appName: 'GnomoTech Minecraft', currentUser, csrf: csrfToken(request, reply),
      year: new Date().getFullYear(), title: 'Página não encontrada', heading: 'Página não encontrada',
      message: 'O endereço informado não existe.', actionHref: '/', actionLabel: 'Voltar ao início', kind: 'error'
    });
  });

  return app;
}
