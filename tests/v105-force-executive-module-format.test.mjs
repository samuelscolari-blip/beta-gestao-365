import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync("app/v105-force-executive-module-format.css", "utf8");
const layout = readFileSync("app/layout.tsx", "utf8");

test("V105 aplica o azul executivo sem depender de :has", () => {
  assert.match(css, /\.page-area \.module-heading/);
  assert.match(css, /\.page-area \.module-guide/);
  assert.match(css, /\.page-area \.mini-kpis article/);
  assert.doesNotMatch(css, /:has\(/);
});

test("V105 preserva as superfícies de dados e altera somente a apresentação", () => {
  assert.match(css, /table-card/);
  assert.match(css, /--v105-data-surface-preserved/);
  assert.match(css, /Textos, dados, ações, cálculos, tabelas, formulários e regras permanecem intactos/);
});

test("V105 é a última camada CSS carregada no layout", () => {
  const v104 = layout.indexOf('import "./v104-executive-panel-continuation.css";');
  const v105 = layout.indexOf('import "./v105-force-executive-module-format.css";');
  const metadata = layout.indexOf("export const metadata");

  assert.ok(v104 >= 0);
  assert.ok(v105 > v104);
  assert.ok(v105 < metadata);
  assert.equal(
    layout.slice(v105, metadata).match(/import\s+"\.\/.*\.css";/g)?.length,
    1,
  );
});
