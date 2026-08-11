# Minecraft Access Portal

Portal web para cadastro de jogadores, confirmação de e-mail e integração automática com a whitelist de um servidor Minecraft.

## Destaques técnicos

- Node.js, TypeScript e Fastify.
- PostgreSQL com migrations SQL versionadas.
- Sessões persistidas no banco e cookies `HttpOnly`, `Secure` e `SameSite=Lax`.
- Proteção CSRF, limitação de requisições, CSP e validação de entradas.
- Confirmação de e-mail via SMTP e integração RCON em rede privada.
- Painéis de jogador e administrador, com revogação imediata de sessões.
- Containers sem portas públicas e segredos montados como arquivos.
- Testes automatizados com Vitest.

## Fluxo

```text
Cadastro -> Confirmação de e-mail -> Validação -> Comando RCON -> Whitelist
```

## Estrutura

```text
src/
  db/            migrations e conexão
  domain/        validações
  lib/           segurança e cookies
  repositories/ persistência
  routes/        páginas e formulários
  services/      e-mail, RCON, sessões e regras de acesso
views/           templates EJS
public/          interface responsiva
migrations/      evolução do PostgreSQL
tests/           testes automatizados
```

## Desenvolvimento

Requer Node.js 22 ou superior e PostgreSQL.

```bash
cp .env.example .env
npm install
npm run build
npm test
npm run dev
```

Em desenvolvimento, `EMAIL_DELIVERY_MODE=log` registra o link de confirmação no console. Esse modo é recusado quando `NODE_ENV=production`.

## Docker

O arquivo `compose.yaml` usa arquivos em `./secrets/`, diretório ignorado pelo Git. Antes de iniciar, crie os quatro arquivos indicados no Compose e configure uma rede Docker externa chamada `minecraft_server` para a integração RCON.

```bash
docker compose up --build
```

Nenhuma senha, token, endereço de produção ou dado de jogador faz parte deste repositório.
