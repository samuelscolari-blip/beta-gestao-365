# Beta Gestão 365

Sistema de gestão da Beta Construtora executado em Next.js/Vinext sobre
Cloudflare Workers, com persistência no Cloudflare D1.

## Produção

- URL: `https://beta-gestao-365.scolarisamuel.workers.dev/`
- Worker: `beta-gestao-365`
- D1: `beta-gestao-365-db`
- Binding: `DB`
- Repositório: `samuelscolari-blip/beta-gestao-365`

O antigo domínio `chatgpt.site` foi aposentado. Este repositório não contém
manifesto do ChatGPT Sites e não deve ser publicado naquela plataforma.

## Requisitos

- Node.js 22.13 ou superior
- npm
- Linux com `flock`, `curl` e GNU `timeout` para os scripts verificados

## Desenvolvimento

```bash
npm ci
npm run dev
```

## Validação

```bash
npm run lint
npm test
```

`npm test` compila o artefato Cloudflare, valida o Worker e o binding D1 e
executa todos os testes. O ambiente gravável utilizado pelos scripts fica em
`.cloudflare-runtime/` e não é versionado.

## Importador V61

A V61 inclui:

- importação `.xlsx` e `.csv`;
- reconhecimento semântico de cabeçalhos;
- sanitização rigorosa de datas, moedas e números;
- prévia antes da gravação;
- processamento em lotes de 250 registros para o D1;
- upsert idempotente por referência ou hash SHA-256;
- isolamento de falhas;
- histórico de importações e fila de pendências.

As tabelas e índices são criados pela migration
`drizzle/0007_clever_daredevil.sql`.

## Publicação

A branch `main` aciona `.github/workflows/deploy-cloudflare.yml`. O workflow
valida o projeto, aplica migrations aditivas no D1 remoto, publica o Worker e
confirma a URL oficial.

Segredos necessários no GitHub Actions:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Para execução manual em um ambiente já autenticado:

```bash
npm run lint
npm test
npm run db:migrate:remote
npm run deploy:cloudflare
```

Nunca coloque tokens ou credenciais em arquivos, commits ou conversas.

## Estrutura

- `app/`: interface, APIs e regras de aplicação
- `db/`: persistência D1
- `drizzle/`: migrations
- `worker/`: entrada do Cloudflare Worker
- `tests/`: testes automatizados
- `.github/workflows/`: validação e publicação
- `services/erp-core/`: núcleo empresarial opcional
- `infra/`: infraestrutura opcional
