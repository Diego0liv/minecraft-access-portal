import { buildApp } from './app.js';
import { config } from './config.js';
import { runMigrations } from './db/migrate.js';
import { pool } from './db/pool.js';

await runMigrations(pool);
const app = await buildApp();

const shutdown = async (signal: string) => {
  app.log.info({ signal }, 'Encerrando aplicação');
  await app.close();
  process.exit(0);
};

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

await app.listen({ host: config.host, port: config.port });

