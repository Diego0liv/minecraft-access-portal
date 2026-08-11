import type { FastifyRequest } from 'fastify';
import { hashToken, SESSION_COOKIE } from '../lib/security.js';
import type { UserRecord, UserRepository } from '../repositories/users.js';

export class SessionService {
  constructor(private readonly users: UserRepository) {}

  async currentUser(request: FastifyRequest): Promise<UserRecord | null> {
    const token = request.cookies[SESSION_COOKIE];
    if (!token) return null;
    return this.users.userBySession(hashToken(token));
  }

  async logout(request: FastifyRequest): Promise<void> {
    const token = request.cookies[SESSION_COOKIE];
    if (token) await this.users.deleteSession(hashToken(token));
  }
}

