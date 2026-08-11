import { describe, expect, it, vi } from 'vitest';
import type { Pool } from 'pg';
import { UserRepository, type UserRecord } from '../src/repositories/users.js';

const player: UserRecord = {
  id: 'player-id',
  email: 'player@example.com',
  minecraft_username: 'player_test',
  password_hash: 'hash',
  role: 'player',
  email_verified_at: new Date(),
  access_status: 'active',
  whitelist_status: 'whitelisted',
  whitelist_error: null,
  last_login_at: null,
  created_at: new Date(),
  updated_at: new Date()
};

describe('UserRepository session security', () => {
  it('only accepts sessions belonging to active users', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const repository = new UserRepository({ query } as unknown as Pool);

    await repository.userBySession('session-hash');

    const sql = String(query.mock.calls[0]?.[0]);
    expect(sql).toContain("u.access_status = 'active'");
    expect(query).toHaveBeenCalledWith(expect.any(String), ['session-hash']);
  });

  it('revokes every player session in the same transaction when blocked', async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('UPDATE users SET access_status')) return { rows: [player] };
      return { rows: [] };
    });
    const release = vi.fn();
    const connect = vi.fn().mockResolvedValue({ query, release });
    const repository = new UserRepository({ connect } as unknown as Pool);

    await repository.setBlocked('admin-id', player.id, true);

    expect(query).toHaveBeenCalledWith(
      'DELETE FROM sessions WHERE user_id = $1',
      [player.id]
    );

    const statements = query.mock.calls.map(([sql]) => sql);
    expect(statements.indexOf('DELETE FROM sessions WHERE user_id = $1'))
      .toBeLessThan(statements.indexOf('COMMIT'));
    expect(release).toHaveBeenCalledOnce();
  });

  it('does not revoke sessions when a player is unblocked', async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('UPDATE users SET access_status')) return { rows: [player] };
      return { rows: [] };
    });
    const connect = vi.fn().mockResolvedValue({ query, release: vi.fn() });
    const repository = new UserRepository({ connect } as unknown as Pool);

    await repository.setBlocked('admin-id', player.id, false);

    expect(query).not.toHaveBeenCalledWith(
      'DELETE FROM sessions WHERE user_id = $1',
      [player.id]
    );
  });
});
