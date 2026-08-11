# Versão 1.0.3

- Bloquear um jogador agora encerra imediatamente todas as sessões dele no portal.
- Sessões de contas que não estejam ativas são recusadas como proteção adicional.
- Domínio de produção configurável por variável de ambiente.
- Conta SMTP removida do código e configurada por variável de ambiente.
- Permissões da imagem corrigidas para garantir leitura pelo usuário `node`.
- O criador interativo de administrador agora encerra a conexão com o banco mesmo quando a entrada é inválida.
- Turnstile e fluxo completo de cadastro, confirmação e whitelist validados em produção.

## Versão 1.0.2

- Correção da configuração do domínio público.

## Versão 1.0.1

## Configuração definida

- Domínio público configurável por ambiente.
- Remetente: `gnomotech@gmail.com`.
- SMTP: Gmail com STARTTLS na porta 587.
- A senha normal do Gmail não é utilizada; a implantação exige uma senha de app em arquivo secreto.

## Versão 1.0.0

Primeira versão do portal GnomoTech Minecraft Access.

## Entregue

- Cadastro público com validação do nome Minecraft.
- Confirmação do e-mail antes da liberação.
- Inclusão automática na whitelist pelo RCON interno.
- Tentativas automáticas quando o Minecraft estiver indisponível.
- Login e painel do jogador.
- Painel administrativo com bloqueio e desbloqueio.
- Lista de nomes reservados para proteger contas existentes.
- PostgreSQL com migration versionada.
- SMTP configurável e Turnstile opcional.
- Docker Compose sem publicação de portas.
- Interface escura e responsiva nas cores da GnomoTech.
- Testes automatizados de validação e renderização das páginas.

## Antes de colocar no ar

Ainda precisam ser informados no servidor:

- domínio definitivo do portal;
- servidor e usuário SMTP;
- senha SMTP em arquivo secreto;
- senha PostgreSQL gerada em arquivo secreto;
- lista completa de nomes Minecraft reservados;
- configuração opcional do Cloudflare Turnstile.

Esses dados não devem ser gravados no código nem enviados em mensagens.
