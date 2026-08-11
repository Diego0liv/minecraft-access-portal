import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { config } from '../config.js';

export const SESSION_COOKIE = 'gnomo_session';
const CSRF_COOKIE = 'gnomo_csrf';

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function csrfToken(request: FastifyRequest, reply: FastifyReply): string {
  const current = request.cookies[CSRF_COOKIE];
  if (current && /^[A-Za-z0-9_-]{32,128}$/.test(current)) return current;

  const token = randomToken(32);
  reply.setCookie(CSRF_COOKIE, token, {
    path: '/',
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: 'lax',
    maxAge: 60 * 60 * 8
  });
  return token;
}

export function verifyCsrf(request: FastifyRequest): boolean {
  const cookie = request.cookies[CSRF_COOKIE] ?? '';
  const body = request.body as Record<string, unknown> | undefined;
  const submitted = typeof body?._csrf === 'string' ? body._csrf : '';
  if (!cookie || !submitted || cookie.length !== submitted.length) return false;
  return timingSafeEqual(Buffer.from(cookie), Buffer.from(submitted));
}

export function setSessionCookie(reply: FastifyReply, token: string): void {
  reply.setCookie(SESSION_COOKIE, token, {
    path: '/',
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: 'lax',
    maxAge: config.sessionDays * 24 * 60 * 60
  });
}

export function clearSessionCookie(reply: FastifyReply): void {
  reply.clearCookie(SESSION_COOKIE, {
    path: '/',
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: 'lax'
  });
}

