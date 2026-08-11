import { config } from '../config.js';

export async function verifyTurnstile(token: string | undefined, remoteIp: string): Promise<boolean> {
  if (!config.turnstile.enabled) return true;
  if (!token) return false;

  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      secret: config.turnstile.secret,
      response: token,
      remoteip: remoteIp
    }),
    signal: AbortSignal.timeout(5_000)
  });
  if (!response.ok) return false;
  const result = await response.json() as { success?: boolean };
  return result.success === true;
}

