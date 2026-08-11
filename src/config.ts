import { readFileSync } from 'node:fs';
import { z } from 'zod';

function secretFromFile(filePath: string | undefined, fallback: string | undefined): string {
  if (filePath) {
    return readFileSync(filePath, 'utf8').trim();
  }
  return fallback?.trim() ?? '';
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  APP_URL: z.string().url().default('http://localhost:3000'),
  APP_NAME: z.string().min(1).default('GnomoTech Minecraft'),
  MINECRAFT_SERVER_ADDRESS: z.string().min(1).default('play.example.com'),
  MINECRAFT_VERSION: z.string().min(1).default('Java'),
  COOKIE_SECURE: z.enum(['true', 'false']).default('false'),
  SESSION_DAYS: z.coerce.number().int().min(1).max(30).default(7),
  RESERVED_MINECRAFT_USERNAMES: z.string().default('gnomoteste,admin,administrator,gnomotech'),
  POSTGRES_HOST: z.string().min(1).default('postgres'),
  POSTGRES_PORT: z.coerce.number().int().min(1).max(65535).default(5432),
  POSTGRES_DB: z.string().min(1).default('minecraft_access'),
  POSTGRES_USER: z.string().min(1).default('minecraft_access'),
  POSTGRES_PASSWORD: z.string().optional(),
  POSTGRES_PASSWORD_FILE: z.string().optional(),
  RCON_HOST: z.string().min(1).default('minecraft-survival'),
  RCON_PORT: z.coerce.number().int().min(1).max(65535).default(25575),
  RCON_PASSWORD: z.string().optional(),
  RCON_PASSWORD_FILE: z.string().optional(),
  EMAIL_DELIVERY_MODE: z.enum(['log', 'smtp']).default('log'),
  EMAIL_FROM: z.string().min(3).default('GnomoTech Minecraft <minecraft@localhost>'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
  SMTP_SECURE: z.enum(['true', 'false']).default('false'),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_PASSWORD_FILE: z.string().optional(),
  TURNSTILE_SITE_KEY: z.string().optional(),
  TURNSTILE_SECRET: z.string().optional(),
  TURNSTILE_SECRET_FILE: z.string().optional()
});

const env = envSchema.parse(process.env);
const postgresPassword = secretFromFile(env.POSTGRES_PASSWORD_FILE, env.POSTGRES_PASSWORD);
const rconPassword = secretFromFile(env.RCON_PASSWORD_FILE, env.RCON_PASSWORD);
const smtpPassword = secretFromFile(env.SMTP_PASSWORD_FILE, env.SMTP_PASSWORD);
const turnstileSecret = secretFromFile(env.TURNSTILE_SECRET_FILE, env.TURNSTILE_SECRET);

if (!postgresPassword) throw new Error('Senha do PostgreSQL não configurada.');
if (!rconPassword) throw new Error('Senha RCON não configurada.');
if (env.NODE_ENV === 'production' && env.EMAIL_DELIVERY_MODE !== 'smtp') {
  throw new Error('Em produção, EMAIL_DELIVERY_MODE deve ser smtp.');
}
if (env.EMAIL_DELIVERY_MODE === 'smtp' && (!env.SMTP_HOST || !env.SMTP_USER || !smtpPassword)) {
  throw new Error('Configuração SMTP incompleta.');
}

export const config = {
  nodeEnv: env.NODE_ENV,
  host: env.HOST,
  port: env.PORT,
  appUrl: env.APP_URL.replace(/\/$/, ''),
  appName: env.APP_NAME,
  minecraftServerAddress: env.MINECRAFT_SERVER_ADDRESS,
  minecraftVersion: env.MINECRAFT_VERSION,
  cookieSecure: env.COOKIE_SECURE === 'true',
  sessionDays: env.SESSION_DAYS,
  reservedMinecraftUsernames: new Set(
    env.RESERVED_MINECRAFT_USERNAMES.split(',').map((name) => name.trim().toLowerCase()).filter(Boolean)
  ),
  postgres: {
    host: env.POSTGRES_HOST,
    port: env.POSTGRES_PORT,
    database: env.POSTGRES_DB,
    user: env.POSTGRES_USER,
    password: postgresPassword
  },
  rcon: {
    host: env.RCON_HOST,
    port: env.RCON_PORT,
    password: rconPassword
  },
  email: {
    mode: env.EMAIL_DELIVERY_MODE,
    from: env.EMAIL_FROM,
    smtpHost: env.SMTP_HOST ?? '',
    smtpPort: env.SMTP_PORT,
    smtpSecure: env.SMTP_SECURE === 'true',
    smtpUser: env.SMTP_USER ?? '',
    smtpPassword
  },
  turnstile: {
    enabled: Boolean(env.TURNSTILE_SITE_KEY && turnstileSecret),
    siteKey: env.TURNSTILE_SITE_KEY ?? '',
    secret: turnstileSecret
  }
} as const;
