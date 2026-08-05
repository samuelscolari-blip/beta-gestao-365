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
export default {
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
     */
    "property-no-unknown": [true, { ignoreProperties: ["composes"] }],
    "selector-pseudo-class-no-unknown": [
      true,
      { ignorePseudoClasses: ["global", "local"] },
    ],
  },
};
