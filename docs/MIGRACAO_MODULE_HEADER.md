# Migração do cabeçalho de módulo — documento de passagem

Estado em que a reforma do CSS parou, com tudo que foi **medido** (não
suposto) para que a etapa final seja executada sem redescobrir nada.

## Onde paramos

| Etapa | Estado | Verificação |
|---|---|---|
| 1 — Congelar a dívida | publicada | travas testadas contra violações reais |
| 2 — Linha de base visual | publicada | detecção de regressão comprovada |
| 3 — Tokens oficiais | publicada | zero diferença visual |
| 4 — Extrair `<ModuleHeader>` | publicada | HTML renderizado idêntico em 6 de 6 telas |
| 5 — Dar CSS próprio ao componente | **não iniciada** | — |

A etapa 4 deixou o componente ainda emitindo a classe global
`.module-heading`, de propósito. Enquanto essa classe existir, o componente
continua exposto às folhas globais — é isso que a etapa 5 resolve.

## A descoberta que mudou o plano

`.module-heading` não é um componente visual: são **três**, escondidos sob o
mesmo nome. Medido no navegador, a 1366px:

| Variante | Layout | Padding | Altura mín. | Ícone | Título |
|---|---|---|---|---|---|
| `executive` | flex | `32px` | `132px` | **58px**, raio 16px | branco, 900 |
| `financial` | flex | `30px 32px` | `164px` | 64px, raio 16px | branco, 900 |
| `standard` | **grid** | `30px 34px` | `166px` | **78px**, raio 21px | `#071d55`, 790 |

Não é ajuste fino: `standard` usa **grid** onde as outras usam **flex**, e o
ícone tem tamanho e raio diferentes. Tratar como uma variante só, com
condicionais, recria exatamente o problema que a reforma quer eliminar.

> **Correção.** Uma versão anterior deste documento registrava 64px para o
> ícone da variante `executive`. Estava errado: são **58px**, vindos de
> `app/v52.css` (`width: 58px !important`), que vence porque as regras do
> V93/V94 se excluem em telas executivas e a do V89 exige abas financeiras.
> O número errado veio de uma medição feita com consulta global ao ícone e
> espera por tempo fixo, que podia capturar a tela anterior. A linha de base
> reforçada — escopada ao cabeçalho visível e sincronizada com a navegação —
> corrigiu o valor. Os números desta tabela agora saem de `visual-baseline.json`.

## Mapa de telas por variante (medido, não suposto)

**`executive`** (12 telas) — Cartão Corporativo, Diário de obra,
Administrativo, Cálculo de Salário, Cálculo de Férias, Rescisão, Impostos,
Aluguéis, Documentos, E-mails, Integrações, Alimentação.

**`financial`** (2 telas visíveis ao visitante) — Fornecedores e Fiscal e
Compliance. O que as distingue é a presença de `.financial-center-tabs` na
página, que ativa as regras do `v89-financial-ux.css`.

> Atenção: é intuitivo achar que "Fiscal e Compliance" seria `standard` com
> acento de compliance, por causa da classe `compliance-heading`. **Não é.**
> Ele renderiza escuro, com a métrica financeira. A classe semântica existe,
> mas não é ela que decide a estrutura.

**`standard`** (2 telas visíveis ao visitante) — Manual do sistema e Regime
Tributário. A tela Administração também usa esta variante, mas só aparece
para administrador e **não está coberta pela linha de base automática** —
exige conferência manual.

**Cabeçalho oculto** — Execução da Obra e Máquinas renderizam o cabeçalho
genérico com `display: none`, porque já têm painel próprio acima. Hoje isso
vem de `v101-machines-header-dedup.css` (via classe marcada por JavaScript em
`SecureBetaAppV100.tsx`) e de `v107-works-header-dedup.css` (via `:has()`).

Substituto React já identificado, que elimina os dois mecanismos:

```
activeView === "works" || activeView === "assets"
```

Basta passar isso como prop ao `ModulePage`, que decide não renderizar o
cabeçalho. As duas folhas de dedup ficam obsoletas.

## Os sete pontos de renderização

Todos em `app/components/BetaApp.tsx`, já usando `<ModuleHeader>`:

1. `ModulePage` — **atende 18 módulos**, é o ponto de maior alcance
2. Microsoft 365 — `iconClass="microsoft-icon"`
3. Compliance — `variantClass="compliance-heading"`
4. Folha — `variantClass="payroll-heading"`
5. Manual — `variantClass="manual-heading"`
6. Administração — `variantClass="admin-heading"`
7. Regime Tributário — `variantClass="tax-heading"`

## As 126 regras legadas a remover

| Arquivo | Regras |
|---|---|
| `v94-global-header-standard.css` | 38 |
| `v93-financial-header-approved.css` | 25 |
| `v105-force-executive-module-format.css` | 14 |
| `v89-financial-ux.css` | 11 |
| `v79-executive-dark-theme.css` | 9 |
| `v98-vacations-ui.css` | 8 |
| `v84-hybrid-executive-theme.css` | 7 |
| `globals.css` | 6 |
| `v52.css` | 4 |
| `v67.css` | 1 |
| `v92-rentals-admin-ux.css` | 1 |
| `v101-machines-header-dedup.css` | 1 |
| `v107-works-header-dedup.css` | 1 |

Encontre-as com `grep -n "\.module-heading" app/*.css`.

## Plano da etapa 5, dividido por estrutura

**5A — variante `executive`.** Migra as 12 telas executivas para o CSS
Module, sem a classe global. No mesmo trabalho, substitui a deduplicação de
Máquinas e Obra pela condição React. As outras variantes continuam no
caminho legado.

**5B — variante `financial`.** Altura, espaçamento e composição diferentes
justificam variante própria, não um caso especial escondido dentro da
executiva.

**5C — variante `standard` e acentos.** Migra a estrutura em grid e declara
os acentos semânticos por propriedade React (`accent="admin"`,
`"compliance"`, `"payroll"`, `"tax"`). Os acentos devem mudar **tokens
pontuais** — cor do ícone, borda, detalhe — e nunca criar quatro
arquiteturas completas.

**5D — remoção do legado.** Só depois das três migradas: elimina
`.module-heading` do JSX, apaga as 126 regras, remove as folhas de dedup
obsoletas, confirma que nenhuma regra global alcança o componente e atualiza
a catraca com a redução real.

### Padrão transitório, obrigatoriamente temporário

Durante 5A a 5C, o componente mantém o caminho legado apenas para as
variantes ainda **não** migradas:

```tsx
const migrada = variant === "executive";

<section className={migrada ? `${styles.root} ${styles.executive}` : "module-heading"}>
```

A regra que não pode ser quebrada: um elemento **nunca** carrega as duas
classes ao mesmo tempo. Uma ou outra por variante é seguro; as duas juntas
recriam a disputa que originou os defeitos. Este trecho desaparece na 5D.

## Proibições durante a transição

- Não remova regras legadas de variantes ainda não migradas — as telas que
  ainda dependem delas quebram na hora.
- Não use `!important` no CSS Module. O Stylelint reprova, e é proposital.
- Não deixe o CSS adivinhar a variante por `:has()`, pela barra lateral ou
  pela presença de outro elemento. A variante vem do React, como prop.
- Não regrave a linha de base para "fazer passar" uma diferença que você não
  entendeu.

## Critérios de equivalência visual

Antes de publicar cada etapa, rode `npm run baseline:check` e verifique nas
larguras **1920, 1536, 1366, 768 e 390**:

- fundo, borda, raio e sombra do cabeçalho
- cor, tamanho, peso, espaçamento e altura de linha do título
- cor e tamanho do texto de apoio e do texto superior
- tamanho, raio e cor do ícone
- ausência de rolagem horizontal nova

Diferença aceitável é a que não altera o resultado percebido. **Qualquer
mudança real de cor, tamanho ou peso é defeito** — conserte, não regrave.

## Defeito conhecido, ainda não corrigido

"Manual do sistema" e "Regime Tributário" produzem barra de rolagem
horizontal em **todas** as larguras medidas, inclusive 1920px. É anterior a
esta reforma. Está registrado como exceção conhecida em
`tests/visual-baseline.test.mjs`, para que o teste continue pegando
transbordos novos sem esconder estes. A etapa 5C é a oportunidade natural
de corrigir, já que mexe exatamente nessas duas telas.
