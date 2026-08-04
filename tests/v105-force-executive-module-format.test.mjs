import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync("app/v105-force-executive-module-format.css", "utf8");
const layout = readFileSync("app/layout.tsx", "utf8");

test("V105 aplica o azul executivo somente quando a faixa executiva está presente", () => {
  assert.match(css, /\.page-area:has\(\.v52-module-strip\) \.module-heading/);
  assert.match(css, /\.page-area:has\(\.v52-module-strip\) \.module-guide/);
  assert.match(css, /\.page-area:has\(\.v52-module-strip\) \.mini-kpis article/);
});

test("V105 não força o padrão executivo em telas sem a faixa (Admin, Manual, Regime Tributário)", () => {
  assert.doesNotMatch(css, /^\.page-area \.module-heading/m);
  assert.doesNotMatch(css, /^\.page-area \.module-guide/m);
  assert.doesNotMatch(css, /^\.page-area \.mini-kpis/m);
});

test("V105 reaproveita variáveis de cor únicas (--exec-*) em vez de valores soltos repetidos", () => {
  assert.match(css, /--exec-navy-950/);
  assert.match(css, /--exec-line/);
  assert.match(css, /--exec-title/);
});

test("V104 foi removido e substituído pelo V105", () => {
  assert.doesNotMatch(layout, /v104-executive-panel-continuation\.css/);
});

test("V105 é a última camada CSS carregada no layout", () => {
  const v105 = layout.indexOf('import "./v105-force-executive-module-format.css";');
  const metadata = layout.indexOf("export const metadata");

  assert.ok(v105 >= 0);
  assert.ok(v105 < metadata);
  assert.equal(
    layout.slice(v105, metadata).match(/import\s+"\.\/.*\.css";/g)?.length,
    1,
  );
});
