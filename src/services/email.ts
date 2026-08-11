import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { config } from '../config.js';

export class EmailService {
  private readonly transporter: Transporter | null;

  constructor() {
    this.transporter = config.email.mode === 'smtp'
      ? nodemailer.createTransport({
          host: config.email.smtpHost,
          port: config.email.smtpPort,
          secure: config.email.smtpSecure,
          auth: { user: config.email.smtpUser, pass: config.email.smtpPassword }
        })
      : null;
  }

  async sendVerification(email: string, username: string, token: string): Promise<void> {
    const url = `${config.appUrl}/confirmar?token=${encodeURIComponent(token)}`;
    if (!this.transporter) {
      console.info(`[DESENVOLVIMENTO] Confirmação para ${email}: ${url}`);
      return;
    }

    await this.transporter.sendMail({
      from: config.email.from,
      to: email,
      subject: `Confirme seu acesso ao ${config.appName}`,
      text: [
        `Olá, ${username}.`,
        '',
        'Confirme seu cadastro para liberar automaticamente seu nome na whitelist:',
        url,
        '',
        'O link expira em 24 horas. Se você não solicitou o cadastro, ignore esta mensagem.'
      ].join('\n'),
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#18201b">
          <h1 style="color:#167a3e">GnomoTech Minecraft</h1>
          <p>Olá, <strong>${escapeHtml(username)}</strong>.</p>
          <p>Confirme seu cadastro para liberar automaticamente seu nome na whitelist.</p>
          <p><a href="${url}" style="display:inline-block;background:#167a3e;color:white;padding:12px 18px;border-radius:8px;text-decoration:none">Confirmar cadastro</a></p>
          <p style="font-size:13px;color:#66706a">O link expira em 24 horas. Se você não solicitou o cadastro, ignore esta mensagem.</p>
        </div>`
    });
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[character] ?? character);
}

