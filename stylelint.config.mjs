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
/**
 * Único arquivo autorizado a usar `:global()`, e apenas enquanto a migração
 * do cabeçalho estiver em andamento. Deve desaparecer ao fim dela.
 */
export const GLOBAL_ESCAPE_HATCH = "app/styles/legacy-bridge.module.css";

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
  overrides: [
    {
      /*
       * CSS Modules nomeiam classes em camelCase por convenção, porque elas
       * são acessadas como `styles.titleWrap` no componente. O padrão
       * kebab-case do config base obrigaria `styles["title-wrap"]` em toda
       * referência, sem ganho nenhum.
       */
      files: ["**/*.module.css"],
      rules: {
        "selector-class-pattern": [
          "^[a-z][a-zA-Z0-9]*$",
          { message: "Use camelCase nas classes de CSS Modules." },
        ],
      },
    },
    {
      /*
       * O arquivo-ponte é o único que cita nomes de classes globais do
       * legado, dentro de `:global()`. Esses nomes são kebab-case porque
       * já existem — `legacy-hook` não pode virar `legacyHook` só para
       * agradar o linter, ou deixa de casar com o HTML. A exigência de
       * camelCase vale para classes que o CSS Module DEFINE, não para as
       * que ele cita.
       */
      files: [GLOBAL_ESCAPE_HATCH],
      rules: {
        "selector-class-pattern": null,

        /*
         * O teto de 0,3,0 existe para o CSS novo, que é dono dos próprios
         * elementos e não precisa brigar. O arquivo-ponte é o oposto por
         * definição: ele repinta peças legadas dentro do cabeçalho, e
         * precisa vencer regras do tipo `.button.primary:hover`, que já
         * são 0,3,0. Com o mesmo teto, empataria e o vencedor passaria a
         * depender da ordem de injeção do bundler — uma aposta, não uma
         * decisão.
         *
         * A folga é de um degrau só, e vale exclusivamente aqui. Some
         * junto com o arquivo, na etapa 5D.
         */
        "selector-max-specificity": "0,4,0",
      },
    },
  ],
};

export default config;
