# Mapa técnico do Beta Gestão 365

## Arquitetura

| Camada | Tecnologia | Local principal |
| --- | --- | --- |
| Interface | React 19 + Next.js 16 + Vinext | `app/` |
| Hospedagem | Cloudflare Workers | `worker/`, `wrangler.jsonc` |
| Banco | Cloudflare D1 + Drizzle | `db/`, `drizzle/` |
| APIs | Route handlers | `app/api/` |
| Importação V61 | Excel/CSV, semântica, sanitização e lotes | `app/lib/spreadsheet*`, `db/records.ts` |
| Cálculos | TypeScript | `packages/` |
| Testes | Node Test Runner | `tests/` |
| CI/CD | GitHub Actions | `.github/workflows/` |
| ERP Core opcional | NestJS + PostgreSQL + Redis/BullMQ | `services/erp-core/` |

## Arquivos principais

| Arquivo ou pasta | Responsabilidade |
| --- | --- |
| `app/components/BetaApp.tsx` | Interface, módulos e importador |
| `app/lib/modules.ts` | Definições dos módulos e aliases |
| `app/lib/spreadsheet.ts` | Leitura e classificação de Excel/CSV |
| `app/lib/spreadsheet-semantic.mjs` | Mapeamento semântico de cabeçalhos |
| `app/lib/spreadsheet-sanitizer.mjs` | Datas, números e moedas |
| `app/lib/server-access.ts` | Autorização administrativa |
| `app/api/records/route.ts` | API central e isolamento de falhas |
| `db/records.ts` | D1, upsert, auditoria e relatórios |
| `db/schema.ts` | Modelo do D1 |
| `drizzle/` | Migrations aditivas |
| `wrangler.jsonc` | Worker, D1 e variáveis não secretas |
| `.github/workflows/deploy-cloudflare.yml` | Publicação oficial |

## Importador V61

O navegador lê `.xlsx` e `.csv`, identifica o módulo e os cabeçalhos, sanitiza
cada célula e apresenta uma prévia. A API revalida os registros em lotes de até
250 operações, aplica upsert idempotente e grava erros isolados nas tabelas
`importacoes` e `importacao_erros`.

As chaves de importação são armazenadas com SHA-256. Colunas não reconhecidas
são ignoradas, e dados inválidos não contaminam registros válidos do mesmo
arquivo.

## Segurança e dados

- Toda mutação exige administrador no servidor.
- Registros permanecem vinculados ao tenant.
- Auditoria é imutável e encadeada por hash.
- Segredos ficam fora do repositório.
- D1 evolui somente por migrations aditivas.
- Visitantes recebem dados sensíveis redigidos e não podem gravar.
