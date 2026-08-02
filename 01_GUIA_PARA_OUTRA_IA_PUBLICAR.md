# Guia de implementação e publicação

## Objetivo

Continuar o Beta Gestão 365 no GitHub e publicar versões validadas no Worker
existente, preservando o D1 e o endereço oficial.

## Contrato de continuidade

1. Usar o repositório `samuelscolari-blip/beta-gestao-365`.
2. Publicar exclusivamente em
   `https://beta-gestao-365.scolarisamuel.workers.dev/`.
3. Preservar o Worker `beta-gestao-365`, o D1 `beta-gestao-365-db` e o binding
   `DB`.
4. Nunca usar o antigo ChatGPT Sites nem recriar `.openai/hosting.json`.
5. Preservar todas as migrations aplicadas e criar somente migrations
   aditivas.
6. Não incluir segredos em código, conversas, commits ou arquivos de entrega.
7. Validar lint, build e testes antes de integrar em `main`.

## Publicação automática

O workflow `.github/workflows/deploy-cloudflare.yml` é executado a cada push na
branch `main` e também pode ser iniciado manualmente. Ele:

1. instala as dependências pelo lockfile;
2. executa lint;
3. compila e executa todos os testes;
4. aplica migrations pendentes no D1 remoto;
5. publica o Worker pelo Vinext/Wrangler;
6. confirma resposta HTTP 200 no endereço oficial.

O workflow usa os segredos protegidos `CLOUDFLARE_API_TOKEN` e
`CLOUDFLARE_ACCOUNT_ID`. Os valores não podem aparecer no código ou nos logs.

## Validação local

```bash
npm ci
npm run lint
npm test
```

Para validar uma migration sem tocar em produção, use um D1 local. A aplicação
remota das migrations deve ocorrer somente pelo workflow de produção.

## Dados existentes

- Não editar migrations antigas.
- Não executar `DROP TABLE`, exclusões em massa ou recriação do banco.
- Fazer backup e plano de retorno antes de qualquer evolução sensível.
- Manter compatibilidade com registros históricos.
- Não importar exemplos fictícios como dados reais.

## Reversão

Se uma publicação falhar, interrompa novas mudanças, registre o erro e corrija
o código em outra versão. Não apague o banco. Quando necessário, reverta o
Worker para um commit validado e mantenha as migrations aditivas já aplicadas.
