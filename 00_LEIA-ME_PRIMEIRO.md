# Beta Gestão 365 — continuidade oficial

Este repositório contém o código-fonte do Beta Gestão 365 / Beta Construtora.
A linha de desenvolvimento atual é a V61, com importação inteligente de
planilhas, processamento em lotes, upsert idempotente e relatório de
pendências no Cloudflare D1.

## Destino definitivo

- GitHub: `samuelscolari-blip/beta-gestao-365`
- Worker: `beta-gestao-365`
- Produção: `https://beta-gestao-365.scolarisamuel.workers.dev/`
- D1: `beta-gestao-365-db`
- Binding: `DB`

O endereço `chatgpt.site` foi aposentado e não pode receber novas versões. A
identidade antiga do ChatGPT Sites também não faz mais parte do artefato.

## Regras de continuidade

- Preserve o Worker, o banco D1, o binding `DB`, os dados e as migrations.
- Nunca corrija um problema recriando ou apagando o banco.
- Crie apenas migrations novas e aditivas.
- Não coloque tokens, senhas, cookies, certificados ou dados reais no Git.
- Faça a publicação pela branch `main` e pelo workflow
  `.github/workflows/deploy-cloudflare.yml`.
- Execute lint, build e testes antes da integração.

## Ordem de leitura

1. `01_GUIA_PARA_OUTRA_IA_PUBLICAR.md`
2. `02_AUTORIZACAO_DE_CONTINUIDADE_E_PUBLICACAO.md`
3. `03_MAPA_TECNICO_DO_PROJETO.md`
4. `04_CHECKLIST_DE_PUBLICACAO.md`
5. `05_CREDENCIAIS_E_PERMISSOES.md`
6. `07_INVENTARIO_DE_ACESSOS_NECESSARIOS.md`
