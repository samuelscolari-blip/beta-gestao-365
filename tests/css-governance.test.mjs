/*
 * Governança de CSS — impede que a dívida cresça durante a migração.
 *
 * Estes testes não exigem que o CSS legado seja consertado. Eles apenas
 * garantem que ninguém (pessoa ou sessão de IA) empilhe mais uma camada
 * global por cima das que já existem, que é exatamente como o projeto
 * chegou a 41 arquivos disputando os mesmos elementos.
 *
 * As provas de que as travas funcionam usam CSS fictício em memória, nunca
 * um arquivo quebrado versionado no repositório.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import stylelint from "stylelint";

import {
  VERSIONED_NAME,
  auditRepository,
  compareWithBaseline,
  countHasSelectors,
  countImportant,
  extractLegacyImports,
  listLegacyCssFiles,
  readBaseline,
} from "../scripts/audit-css-debt.mjs";

const baseline = readBaseline();
const layout = readFileSync("app/layout.tsx", "utf8");

test("nenhuma camada CSS global nova foi adicionada ao layout", () => {
  const permitidos = new Set(baseline.frozenLegacyImports);
  const novos = extractLegacyImports(layout).filter((f) => !permitidos.has(f));

  assert.deepEqual(
    novos,
    [],
    `Camada CSS global nova detectada: ${novos.join(", ")}.\n` +
      "Corrija o componente responsável em vez de criar mais uma folha por cima.\n" +
      "CSS novo deve viver em app/styles/ ou num CSS Module do componente.",
  );
});

test("nenhum arquivo CSS versionado novo foi criado em app/", () => {
  const permitidos = new Set(baseline.frozenLegacyFiles);
  const novos = listLegacyCssFiles().filter(
    (nome) => VERSIONED_NAME.test(nome) && !permitidos.has(nome),
  );

  assert.deepEqual(
    novos,
    [],
    `Arquivo CSS versionado novo detectado: ${novos.join(", ")}.`,
  );
});

test("o bloqueio pega versão em qualquer posição do nome, não só no início", () => {
  // 5 arquivos reais do projeto têm a versão no meio do nome. Um padrão
  // ancorado no início (^v\d+) deixaria passar um "novo-painel-v108.css".
  assert.ok(VERSIONED_NAME.test("v52.css"));
  assert.ok(VERSIONED_NAME.test("construction-v54.css"));
  assert.ok(VERSIONED_NAME.test("cost-map-readability-v58.css"));
  assert.ok(VERSIONED_NAME.test("professional-layout-v64.css"));
  assert.ok(VERSIONED_NAME.test("novo-painel-v108.css"));
  assert.ok(!VERSIONED_NAME.test("tokens.css"));
  assert.ok(!VERSIONED_NAME.test("ModuleHeader.module.css"));
});

test("a dívida de CSS não aumentou em relação ao teto", () => {
  const excedidas = compareWithBaseline(auditRepository(), baseline);

  assert.deepEqual(
    excedidas.map((item) => `${item.label}: ${item.current} > ${item.ceiling}`),
    [],
    "A dívida de CSS cresceu. NÃO aumente o teto para fazer o CI passar — " +
      "o teto existe para cair.",
  );
});

test("a auditoria conta declarações reais e ignora comentários", () => {
  // Prova que a trava funciona, sem manter CSS quebrado no repositório.
  const cssInvalido = `
    .exemplo {
      color: red !important;
      background: blue !important;
    }
  `;
  assert.equal(countImportant(cssInvalido), 2);

  const cssComComentario = `
    /* Explicação citando !important e :has(.algo) em texto. */
    .exemplo:has(.filho) {
      color: red;
    }
  `;
  assert.equal(countImportant(cssComComentario), 0);
  assert.equal(countHasSelectors(cssComComentario), 1);
});

test("o Stylelint reprova CSS novo que repete os problemas do legado", async () => {
  const { results } = await stylelint.lint({
    code: "#app .a .b .c .d .e { color: red !important; }",
    configFile: "stylelint.config.mjs",
    codeFilename: "app/ui/Exemplo/Exemplo.module.css",
  });

  const regras = results[0].warnings.map((w) => w.rule).sort();
  assert.deepEqual(regras, [
    "declaration-no-important",
    "selector-max-compound-selectors",
    "selector-max-id",
    "selector-max-specificity",
  ]);
});

test("o Stylelint aceita a sintaxe legítima de CSS Modules", async () => {
  // Sem as liberações de `composes` e `:global()`, a própria migração de
  // componentes seria bloqueada pelo linter.
  const { results } = await stylelint.lint({
    code: [
      ".root {",
      "  display: grid;",
      "  gap: var(--space-6);",
      "}",
      "",
      ".title {",
      "  composes: root;",
      "  margin: 0;",
      "}",
      "",
      ":global(.legacy-hook) .title {",
      "  color: inherit;",
      "}",
      "",
    ].join("\n"),
    configFile: "stylelint.config.mjs",
    codeFilename: "app/ui/Exemplo/Exemplo.module.css",
  });

  assert.deepEqual(results[0].warnings, []);
});
