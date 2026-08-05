/*
 * Stylelint — regras de arquitetura para CSS NOVO.
 *
 * Escopo intencionalmente restrito: só vale para `app/styles/**` e para os
 * CSS Modules (`*.module.css`). O CSS legado (globals.css e as camadas vNN)
 * fica de fora de propósito — se entrasse agora, o CI produziria milhares de
 * falhas e bloquearia qualquer trabalho, sem ajudar a migração.
 *
 * A dívida do legado é controlada pela catraca em `scripts/audit-css-debt.mjs`,
 * que impede o problema de crescer enquanto a migração acontece.
 */
const config = {
  extends: ["stylelint-config-standard"],
  rules: {
    /* As quatro regras que impedem o CSS novo de repetir o problema atual. */
    "declaration-no-important": true,
    "selector-max-id": 0,
    "selector-max-specificity": "0,3,0",
    "selector-max-compound-selectors": 4,

    /*
     * `composes` e `:global()` são sintaxe legítima de CSS Modules, mas o
     * stylelint-config-standard não os conhece e os reprova como inválidos.
     * Sem estas duas liberações, o Stylelint barraria justamente o código
     * que a migração de componentes precisa escrever.
     *
     * `:global()` fica reconhecido, mas NÃO liberado para uso geral: ele
     * permitiria a um CSS Module voltar a estilizar classes globais — um
     * `:global(.module-heading) { … }` recriaria a disputa que a migração
     * existe para acabar. O uso é restrito ao arquivo-ponte abaixo, e
     * `tests/css-governance.test.mjs` reprova qualquer outro lugar.
     */
    "property-no-unknown": [true, { ignoreProperties: ["composes"] }],
    "selector-pseudo-class-no-unknown": [
      true,
      { ignorePseudoClasses: ["global", "local"] },
    ],
  },
};

/**
 * Único arquivo autorizado a usar `:global()`, e apenas enquanto a migração
 * do cabeçalho estiver em andamento. Deve desaparecer ao fim dela.
 */
export const GLOBAL_ESCAPE_HATCH = "app/styles/legacy-bridge.module.css";

export default config;
