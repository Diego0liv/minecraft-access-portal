import bcrypt from 'bcryptjs';
import { config } from '../config.js';
import { hashToken, randomToken } from '../lib/security.js';
import type { UserRecord, UserRepository } from '../repositories/users.js';
import type { EmailService } from './email.js';
import type { MinecraftService } from './minecraft.js';

export class AccessService {
  constructor(
    private readonly users: UserRepository,
    private readonly minecraft: MinecraftService,
    private readonly email: EmailService
  ) {}

  async register(email: string, minecraftUsername: string, password: string): Promise<void> {
    const verificationToken = randomToken();
    const passwordHash = await bcrypt.hash(password, 12);
    await this.users.createPending({
      email,
      minecraftUsername,
      passwordHash,
      verificationTokenHash: hashToken(verificationToken),
      verificationExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
    });
    await this.email.sendVerification(email, minecraftUsername, verificationToken);
  }

  async resendVerification(email: string): Promise<void> {
    const user = await this.users.findByEmail(email);
    if (!user || user.email_verified_at || user.access_status === 'blocked') return;
    const token = randomToken();
    await this.users.replaceVerificationToken(
      user.id,
      hashToken(token),
      new Date(Date.now() + 24 * 60 * 60 * 1000)
    );
    await this.email.sendVerification(user.email, user.minecraft_username, token);
  }

  async confirm(token: string): Promise<UserRecord | null> {
    const user = await this.users.confirmEmail(hashToken(token));
    if (!user || user.access_status === 'blocked') return user;
    await this.reconcileUser(user);
    return this.users.findById(user.id);
  }

  async authenticate(email: string, password: string): Promise<{ user: UserRecord; token: string } | null> {
    const user = await this.users.findByEmail(email);
    if (!user || !user.email_verified_at || user.access_status !== 'active') return null;
    if (!(await bcrypt.compare(password, user.password_hash))) return null;

    const token = randomToken();
    const expiresAt = new Date(Date.now() + config.sessionDays * 24 * 60 * 60 * 1000);
    await this.users.createSession(user.id, hashToken(token), expiresAt);
    return { user, token };
  }

  async reconcilePending(): Promise<void> {
    for (const user of await this.users.pendingWhitelist()) {
      await this.reconcileUser(user);
    }
  }

  async reconcileUser(user: UserRecord): Promise<void> {
    try {
      await this.minecraft.addToWhitelist(user.minecraft_username);
      await this.users.updateWhitelist(user.id, 'whitelisted', null);
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 500) : 'Falha desconhecida no RCON.';
      await this.users.updateWhitelist(user.id, 'error', message);
    }
  }

  async block(actorId: string, targetId: string): Promise<void> {
    const user = await this.users.setBlocked(actorId, targetId, true);
    if (!user) throw new Error('Jogador não encontrado ou protegido.');
    try {
      await this.minecraft.removeFromWhitelist(user.minecraft_username);
      await this.users.updateWhitelist(user.id, 'removed', null);
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 500) : 'Falha ao remover whitelist.';
      await this.users.updateWhitelist(user.id, 'error', message);
      throw error;
    }
  }

  async unblock(actorId: string, targetId: string): Promise<void> {
    const user = await this.users.setBlocked(actorId, targetId, false);
    if (!user) throw new Error('Jogador não encontrado ou protegido.');
    await this.reconcileUser(user);
  }
}

