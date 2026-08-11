import { pool } from './pool.js';
import { runMigrations } from './migrate.js';

await runMigrations(pool);
await pool.end();
console.log('Migrations aplicadas com sucesso.');

