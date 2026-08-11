import { join } from 'node:path';
import ejs from 'ejs';
import { describe, expect, it } from 'vitest';

const root = join(process.cwd(), 'views');
const common = {
  appName: 'GnomoTech Minecraft', currentUser: null, csrf: 'csrf-token', year: 2026
};
const user = {
  id: '00000000-0000-0000-0000-000000000001', email: 'jogador@example.com',
  minecraft_username: 'gnomoteste', role: 'player', access_status: 'active',
  whitelist_status: 'whitelisted', created_at: new Date('2026-07-31T00:00:00Z')
};

const cases: Array<[string, Record<string, unknown>]> = [
  ['index.ejs', { ...common, title: 'Início', serverAddress: 'example.test', minecraftVersion: '26.2' }],
  ['register.ejs', { ...common, title: 'Cadastro', errors: [], values: {}, turnstile: { enabled: false, siteKey: '' } }],
  ['login.ejs', { ...common, title: 'Login', errors: [], email: '' }],
  ['resend.ejs', { ...common, title: 'Reenviar', errors: [] }],
  ['message.ejs', { ...common, title: 'Mensagem', heading: 'Tudo certo', message: 'Concluído', actionHref: '/', actionLabel: 'Voltar', kind: 'success' }],
  ['dashboard.ejs', { ...common, currentUser: user, title: 'Painel', user, serverAddress: 'example.test', minecraftVersion: '26.2' }],
  ['admin.ejs', { ...common, currentUser: { ...user, role: 'admin' }, title: 'Admin', users: [user], minecraftStatus: '0 de 20 jogadores' }]
];

describe('templates da interface', () => {
  for (const [template, data] of cases) {
    it(`renderiza ${template}`, async () => {
      const html = await ejs.renderFile(join(root, template), data);
      expect(html).toContain('<!doctype html>');
      expect(html).toContain('GnomoTech');
    });
  }
});

