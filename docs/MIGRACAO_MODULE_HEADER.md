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
| 5A — CSS próprio da `executive` | publicada | linha de base sem diferença visual nas 12 telas |
| 5B — CSS próprio da `financial` | publicada | linha de base sem diferença visual nas 2 telas |
| 5C — CSS próprio da `standard` | publicada | linha de base sem diferença visual nas 2 telas |
| 5D — remoção do legado | publicada | 112 regras removidas, zero diferença visual |

A etapa 4 deixou o componente ainda emitindo a classe global
`.module-heading`, de propósito. Enquanto essa classe existir, o componente
continua exposto às folhas globais — é isso que a etapa 5 resolve, uma
variante por vez.

**A migração terminou.** As três variantes têm CSS próprio, as 112 regras
globais que estilizavam o cabeçalho foram removidas, e duas folhas inteiras
(`v93` e `v94`) deixaram de existir por terem sobrado sem nenhuma regra.

Redução medida da dívida:

| | antes | depois |
|---|---|---|
| `!important` | 1282 | **1078** |
| `:has()` | 158 | **86** |
| folhas globais | 41 | **39** |

### O que a 5A mediu, e o que sobrou

`npm run baseline:check` fechou com **10 diferenças, todas do mesmo tipo**:
`headerCount` caindo de 1 para 0 em Execução da Obra e Máquinas, nas cinco
larguras. Não é regressão, é a correção: antes o cabeçalho era renderizado e
depois escondido por CSS; agora não é renderizado. O `visibleHeaderCount`
dessas telas já era 0 antes e continua 0 — nenhum pixel mudou.

Duas diferenças reais apareceram no caminho e foram corrigidas, não
regravadas:

- **O ícone da Rescisão** é o único que é uma letra ("R"). Tamanho e peso
  vinham da classe `termination-icon`, que a variante migrada deixou de
  emitir; sem isso a letra caía de 16px para 15px. Virou `iconKind="letter"`,
  uma exceção declarada em vez de herdada por acidente.
- **A primeira tentativa de corrigir isso** aplicou o tamanho a todos os
  ícones e quebrou as outras 12 telas — a medição mostrou que o ícone comum
  computa 15px, e só o da Rescisão computa 16px. Vale como aviso: ler o CSS
  legado diz qual regra *parece* vencer; só a medição diz qual vence.

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

**Cabeçalho oculto** — Execução da Obra e Máquinas não renderizam o
cabeçalho genérico, porque já têm painel próprio acima. Desde a 5A isso é
decidido pelo React (`hideHeading`), e não mais por CSS. As folhas
`v101` e `v107` continuam existindo, mas só pelo espaçamento da pilha:
a regra que escondia o cabeçalho saiu na 5D.

## Os sete pontos de renderização

Todos em `app/components/BetaApp.tsx`, já usando `<ModuleHeader>`:

1. `ModulePage` — **atende 18 módulos**, é o ponto de maior alcance
2. Microsoft 365 — `iconClass="microsoft-icon"`
3. Compliance — `variantClass="compliance-heading"`
4. Folha — `variantClass="payroll-heading"`
5. Manual — `variantClass="manual-heading"`
6. Administração — `variantClass="admin-heading"`
7. Regime Tributário — `variantClass="tax-heading"`

## As 112 regras legadas — removidas na 5D

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

**5A — variante `executive`. Concluída.** Migrou as 12 telas executivas para
o CSS Module, sem a classe global, e substituiu a deduplicação de Máquinas e
Obra pela condição React (`hideHeading`). As outras variantes continuam no
caminho legado.

**5B — variante `financial`. Concluída.** Migrou Fornecedores e Fiscal e
Compliance. Apesar do nome, ela é escura como a executiva: fundo, borda,
sombra e cor de texto medem igual nas cinco larguras. O que muda é a
ESCALA — altura 164px contra 132px, ícone 64px contra 58px, olho 12px
contra 11,52px, parágrafo 15px em 920px contra 14,56px em 780px, e recuo
assimétrico contra uniforme. É diferença suficiente para variante própria,
e não para um caso especial escondido dentro da executiva.

Três coisas que a 5B ensinou, e que a 5C vai reencontrar:

- **`rem` engana em 390px.** A raiz encolhe para 15px nessa largura, então
  `0.75rem` não dá os 12px que o legado fixa. Onde o legado usa px
  absoluto, o CSS Module também precisa usar.
- **O `!important` do V52 vencia o CSS Module.** `.page-area p` alcançava o
  parágrafo do cabeçalho e nenhuma declaração do componente conseguia
  passar por cima. Resolvido com uma ressalva em `:where()`, que não soma
  especificidade e por isso não muda nada fora do cabeçalho.
- **O bloco de ações vem pronto de fora.** Selos e botões chegam com
  classes globais próprias, e o V105 os adaptava ao fundo escuro exigindo
  `.module-heading`. Ao migrar, a adaptação some junto. Daí o arquivo-ponte
  `app/styles/legacy-bridge.module.css`, que deve morrer na 5D.

**5C — variante `standard`. Concluída.** Migrou Manual do sistema e Regime
Tributário: a estrutura em grid, clara, com o círculo decorativo do
`::after`. Com ela, as três variantes têm CSS próprio e nenhuma tela
depende mais das regras globais.

**Os acentos semânticos não foram implementados, de propósito.** O plano
previa mudar tokens pontuais por `accent="tax"`, `"admin"` e afins. A
medição desautorizou: Manual (`accent="none"`) e Regime Tributário
(`accent="tax"`) computam valores IDÊNTICOS em ícone, título, olho e
parágrafo, nas cinco larguras. O mesmo já valia para a executiva. Ou seja,
os acentos não têm efeito visual em nenhuma tela coberta pela linha de
base — implementá-los agora seria inventar aparência nova, não preservar a
existente. O `data-accent` continua no DOM, pronto para quando houver uma
distinção real a fazer.

O único ponto que exige atenção nesta variante é o `position: relative`.
O `::after` usa `right: -56px`, e sem bloco de contenção próprio ele se
posiciona pela viewport — aí `overflow: hidden` não o recorta, porque
`overflow` só corta descendentes contidos pelo próprio elemento. Eram
exatamente 56px de rolagem horizontal, em todas as larguras. A linha de
base vigia isso em `overflowsHorizontally`.

**5D — remoção do legado.** As três já estão migradas, então esta etapa
está liberada. Ela elimina `.module-heading` do JSX, apaga as regras
legadas, remove as folhas de dedup obsoletas, mata o arquivo-ponte
`app/styles/legacy-bridge.module.css`, devolve o teto de especificidade
dele a 0,3,0 e atualiza a catraca com a redução real.

O caminho legado segue no componente até lá, de propósito: tirar uma
variante da lista em `const migrada = …` devolve aquelas telas ao
comportamento antigo em uma linha, se algo aparecer errado em produção.
É a rede que torna a 5D segura.

### Padrão transitório, obrigatoriamente temporário

Durante 5A a 5C, o componente mantém o caminho legado apenas para as
variantes ainda **não** migradas:

```tsx
const migrada = variant === "executive";

const proprias = { root: `${styles.root} ${styles.executive}`, /* … */ };
const legadas  = { root: "module-heading", /* … */ };

const cls = migrada ? proprias : legadas;
```

A regra que não pode ser quebrada: um elemento **nunca** carrega as duas
classes ao mesmo tempo. Uma ou outra por variante é seguro; as duas juntas
recriam a disputa que originou os defeitos.

Por isso a escolha fica nesses **dois objetos**, e não espalhada em ternários
dentro do JSX: assim as duas famílias não têm como se misturar, e
`tests/module-header-component.test.mjs` consegue conferir a regra lendo o
arquivo, sem navegador — o que importa, porque a linha de base precisa de
Chromium e **não roda no CI**. Ao migrar 5B e 5C, mantenha esse formato.
Todo o trecho desaparece na 5D.

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
