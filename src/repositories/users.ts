import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';

export type UserRole = 'player' | 'admin';
export type AccessStatus = 'pending_email' | 'active' | 'blocked';
export type WhitelistStatus = 'pending' | 'whitelisted' | 'error' | 'removed';

export interface UserRecord {
  id: string;
  email: string;
  minecraft_username: string;
  password_hash: string;
  role: UserRole;
  email_verified_at: Date | null;
  access_status: AccessStatus;
  whitelist_status: WhitelistStatus;
  whitelist_error: string | null;
  last_login_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export class UserRepository {
  constructor(private readonly db: Pool) {}

  async createPending(input: {
    email: string;
    minecraftUsername: string;
    passwordHash: string;
    verificationTokenHash: string;
    verificationExpiresAt: Date;
  }): Promise<UserRecord> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      const userId = randomUUID();
      const result = await client.query<UserRecord>(
        `INSERT INTO users(id, email, minecraft_username, password_hash)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [userId, input.email, input.minecraftUsername, input.passwordHash]
      );
      await client.query(
        `INSERT INTO email_verification_tokens(id, user_id, token_hash, expires_at)
         VALUES ($1, $2, $3, $4)`,
        [randomUUID(), userId, input.verificationTokenHash, input.verificationExpiresAt]
      );
      await this.audit(client, null, userId, 'user.registered', { minecraftUsername: input.minecraftUsername });
      await client.query('COMMIT');
      const user = result.rows[0];
      if (!user) throw new Error('Usuário não retornado após cadastro.');
      return user;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    const result = await this.db.query<UserRecord>('SELECT * FROM users WHERE email = $1', [email]);
    return result.rows[0] ?? null;
  }

  async findById(id: string): Promise<UserRecord | null> {
    const result = await this.db.query<UserRecord>('SELECT * FROM users WHERE id = $1', [id]);
    return result.rows[0] ?? null;
  }

  async confirmEmail(tokenHash: string): Promise<UserRecord | null> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      const token = await client.query<{ id: string; user_id: string }>(
        `SELECT id, user_id FROM email_verification_tokens
         WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()
         FOR UPDATE`,
        [tokenHash]
      );
      const row = token.rows[0];
      if (!row) {
        await client.query('ROLLBACK');
        return null;
      }
      await client.query('UPDATE email_verification_tokens SET used_at = NOW() WHERE id = $1', [row.id]);
      const result = await client.query<UserRecord>(
        `UPDATE users
         SET email_verified_at = COALESCE(email_verified_at, NOW()),
             access_status = CASE WHEN access_status = 'blocked' THEN 'blocked' ELSE 'active' END,
             whitelist_status = CASE WHEN access_status = 'blocked' THEN 'removed' ELSE 'pending' END,
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [row.user_id]
      );
      await this.audit(client, row.user_id, row.user_id, 'user.email_verified', {});
      await client.query('COMMIT');
      return result.rows[0] ?? null;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async replaceVerificationToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        'UPDATE email_verification_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL',
        [userId]
      );
      await client.query(
        `INSERT INTO email_verification_tokens(id, user_id, token_hash, expires_at)
         VALUES ($1, $2, $3, $4)`,
        [randomUUID(), userId, tokenHash, expiresAt]
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async updateWhitelist(userId: string, status: WhitelistStatus, error: string | null): Promise<void> {
    await this.db.query(
      `UPDATE users SET whitelist_status = $2, whitelist_error = $3, updated_at = NOW() WHERE id = $1`,
      [userId, status, error]
    );
  }

  async pendingWhitelist(limit = 20): Promise<UserRecord[]> {
    const result = await this.db.query<UserRecord>(
      `SELECT * FROM users
       WHERE email_verified_at IS NOT NULL
         AND access_status = 'active'
         AND whitelist_status IN ('pending', 'error')
       ORDER BY updated_at ASC
       LIMIT $1`,
      [limit]
    );
    return result.rows;
  }

  async createSession(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await this.db.query('DELETE FROM sessions WHERE expires_at <= NOW()');
    await this.db.query(
      `INSERT INTO sessions(id, user_id, token_hash, expires_at) VALUES ($1, $2, $3, $4)`,
      [randomUUID(), userId, tokenHash, expiresAt]
    );
    await this.db.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [userId]);
  }

  async userBySession(tokenHash: string): Promise<UserRecord | null> {
    const result = await this.db.query<UserRecord>(
      `SELECT u.* FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = $1
         AND s.expires_at > NOW()
         AND u.access_status = 'active'`,
      [tokenHash]
    );
    return result.rows[0] ?? null;
  }

  async deleteSession(tokenHash: string): Promise<void> {
    await this.db.query('DELETE FROM sessions WHERE token_hash = $1', [tokenHash]);
  }

  async listUsers(): Promise<UserRecord[]> {
    const result = await this.db.query<UserRecord>('SELECT * FROM users ORDER BY created_at DESC');
    return result.rows;
  }

  async setBlocked(actorId: string, targetId: string, blocked: boolean): Promise<UserRecord | null> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query<UserRecord>(
        `UPDATE users SET access_status = $2, whitelist_status = $3, updated_at = NOW()
         WHERE id = $1 AND role <> 'admin'
         RETURNING *`,
        [targetId, blocked ? 'blocked' : 'active', blocked ? 'removed' : 'pending']
      );
      const user = result.rows[0];
      if (user) {
        if (blocked) {
          await client.query('DELETE FROM sessions WHERE user_id = $1', [targetId]);
        }
        await this.audit(client, actorId, targetId, blocked ? 'admin.user_blocked' : 'admin.user_unblocked', {});
      }
      await client.query('COMMIT');
      return user ?? null;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async createAdmin(email: string, minecraftUsername: string, passwordHash: string): Promise<void> {
    await this.db.query(
      `INSERT INTO users(id, email, minecraft_username, password_hash, role, email_verified_at, access_status, whitelist_status)
       VALUES ($1, $2, $3, $4, 'admin', NOW(), 'active', 'removed')`,
      [randomUUID(), email, minecraftUsername, passwordHash]
    );
  }

  private async audit(
    client: PoolClient,
    actorUserId: string | null,
    targetUserId: string | null,
    eventType: string,
    metadata: Record<string, unknown>
  ): Promise<void> {
    await client.query(
      `INSERT INTO audit_events(id, actor_user_id, target_user_id, event_type, metadata)
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [randomUUID(), actorUserId, targetUserId, eventType, JSON.stringify(metadata)]
    );
  }
}
