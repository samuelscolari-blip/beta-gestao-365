# Mapa técnico do Beta Gestão 365

## Arquitetura atual

| Camada | Tecnologia | Local principal |
| --- | --- | --- |
| Interface | React 19 + Next.js 16 + Vinext | `app/` |
| Hospedagem | ChatGPT Sites / Cloudflare Worker | `worker/` e `.openai/` |
| Banco operacional | Cloudflare D1 + Drizzle | `db/` e `drizzle/` |
| APIs do portal | Route handlers | `app/api/` |
| Cálculos trabalhistas | TypeScript | `packages/payroll-core/` e `packages/termination-core/` |
| Testes do portal | Node Test Runner | `tests/` |
| Núcleo empresarial opcional | NestJS + PostgreSQL + Redis/BullMQ | `services/erp-core/` |
| Infraestrutura opcional | Docker Compose e Kubernetes | `infra/` |

## Arquivos mais importantes

| Arquivo ou pasta | Responsabilidade |
| --- | --- |
| `app/components/BetaApp.tsx` | Interface principal, dashboards e módulos |
| `app/components/TerminationStudio.tsx` | Tela e memória de rescisão |
| `app/lib/modules.ts` | Definições dos módulos, campos e regras de exibição |
| `app/lib/server-access.ts` | Autorização operacional do administrador |
| `app/lib/spreadsheet.ts` | Importação e exportação de planilhas |
| `app/lib/construction-metrics.ts` | Métricas de produtividade e obra |
| `app/api/records/route.ts` | Leitura e gravação central de registros |
| `db/records.ts` | Persistência dos registros no D1 |
| `db/schema.ts` | Modelo do banco operacional |
| `drizzle/` | Histórico de migrations do D1 |
| `.openai/hosting.json` | Identidade do Site e binding do banco |
| `vite.config.ts` | Build e simulação local dos bindings |
| `scripts/build-verified.sh` | Build verificado da plataforma |
| `scripts/validate-artifact.sh` | Validação do artefato publicável |

## Regras funcionais que devem ser preservadas

- Códigos internos de registros ficam ocultos nas telas comuns, formulários,
  detalhes, relatórios e exportações.
- A visualização temporária desses identificadores é exclusiva do
  administrador e permanece desligada por padrão.
- O módulo operacional de Terceiros fica oculto, sem apagar o histórico.
- Referências legais antes chamadas de "terceiros" na folha foram apresentadas
  como "Outras entidades e fundos"; isso não deve ser confundido com o módulo
  operacional oculto.
- Em Execução da Obra permanece um único percentual físico.
- O Índice Geral da Obra considera avanço, prazo, equipe própria, máquinas,
  horas produtivas e orçamento, normalizando os pesos quando faltam dados.
- O Passo a passo da obra deve permanecer.
- Pedidos para decisão apresenta exemplos fictícios apenas como orientação;
  eles não entram nos totais nem nas ações reais.
- Compras usa somente os estados `Aguardando análise`, `Aprovado` e
  `Reprovado`.
- Visitantes podem consultar, mas não podem gravar.
- As gravações operacionais exigem o administrador definido no servidor.
- IBS/CBS não deve aparecer como desconto de folha.
- Rescisão é uma prévia de cálculo e não transmite eventos oficiais ao eSocial.

## Dados e segurança

- Todo registro persistente deve permanecer vinculado ao tenant da empresa.
- A auditoria é append-only e usa encadeamento por hash.
- Validações de permissão devem ocorrer no servidor, nunca apenas na interface.
- Campos ocultos na interface não podem ser considerados controle de segurança.
- Segredos do ERP Core devem permanecer em cofre e nunca no repositório.

## Testes

O comando principal é:

```bash
npm test
```

Na versão 51 ele cobre, entre outros pontos:

- acesso público somente leitura;
- autorização de gravações;
- persistência por tenant e auditoria;
- métricas de obra, máquinas e ociosidade;
- IBS/CBS e bloqueios fiscais;
- folha 2026;
- rescisões e incidências eSocial;
- os dois cenários de validação exibidos no sistema.

