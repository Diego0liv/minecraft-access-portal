import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Pool } from 'pg';

export async function runMigrations(db: Pool, migrationsDir = join(process.cwd(), 'migrations')): Promise<void> {
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const files = (await readdir(migrationsDir)).filter((name) => name.endsWith('.sql')).sort();
  const applied = await db.query<{ filename: string }>('SELECT filename FROM schema_migrations');
  const appliedNames = new Set(applied.rows.map((row) => row.filename));

  for (const filename of files) {
    if (appliedNames.has(filename)) continue;
    const sql = await readFile(join(migrationsDir, filename), 'utf8');
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations(filename) VALUES ($1)', [filename]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

