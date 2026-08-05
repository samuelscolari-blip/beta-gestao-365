import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync("app/v105-force-executive-module-format.css", "utf8");
const layout = readFileSync("app/layout.tsx", "utf8");
const betaApp = readFileSync("app/components/BetaApp.tsx", "utf8");
const v93 = readFileSync("app/v93-financial-header-approved.css", "utf8");
const v94 = readFileSync("app/v94-global-header-standard.css", "utf8");

test("V105 aplica o azul executivo somente quando data-executive-module=true", () => {
  assert.match(css, /\.page-area\[data-executive-module="true"\] \.module-heading/);
  assert.match(css, /\.page-area\[data-executive-module="true"\] \.module-guide/);
  assert.match(css, /\.page-area\[data-executive-module="true"\] \.mini-kpis article/);
});

test("V105 não depende mais de :has(.v52-module-strip) (a faixa é renderizada fora da árvore de .page-area, então esse seletor nunca casava de verdade)", () => {
  const cssWithoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
  assert.doesNotMatch(cssWithoutComments, /:has\(\.v52-module-strip\)/);
});

test("BetaApp expõe data-executive-module em .page-area usando o mesmo estado (activeModule) que decide a faixa executiva", () => {
  assert.match(
    betaApp,
    /<div className="page-area" data-executive-module=\{activeModule \? "true" : "false"\}>/,
  );
});

test("V105 não força o padrão executivo em telas sem a faixa (Admin, Manual, Regime Tributário)", () => {
  assert.doesNotMatch(css, /^\.page-area \.module-heading/m);
  assert.doesNotMatch(css, /^\.page-area \.module-guide/m);
  assert.doesNotMatch(css, /^\.page-area \.mini-kpis/m);
});

test("V93 e V94 (cabeçalho claro) recuam explicitamente quando data-executive-module=true, para nunca disputar cor/fundo com o V105", () => {
  assert.match(v93, /\.page-area:not\(\[data-executive-module="true"\]\) \.page-stack:has\(\.financial-center-tabs\) > \.module-heading/);
  assert.match(v94, /\.page-area:not\(\[data-executive-module="true"\]\) \.page-stack:not\(:has\(\.financial-center-tabs\)\) > \.module-heading/);
});

test("V105 reaproveita variáveis de cor únicas (--exec-*) em vez de valores soltos repetidos", () => {
  assert.match(css, /--exec-navy-950/);
  assert.match(css, /--exec-line/);
  assert.match(css, /--exec-title/);
});

test("V104 foi removido e substituído pelo V105", () => {
  assert.doesNotMatch(layout, /v104-executive-panel-continuation\.css/);
});

test("V105 carrega antes das correções pontuais V106/V107, que fecham o layout", () => {
  const v105 = layout.indexOf('import "./v105-force-executive-module-format.css";');
  const v106 = layout.indexOf('import "./v106-management-center-contrast.css";');
  const v107 = layout.indexOf('import "./v107-works-header-dedup.css";');
  const metadata = layout.indexOf("export const metadata");

  assert.ok(v105 >= 0);
  assert.ok(v106 > v105);
  assert.ok(v107 > v106);
  assert.ok(v107 < metadata);
  assert.equal(
    layout.slice(v105, metadata).match(/import\s+"\.\/.*\.css";/g)?.length,
    3,
  );
});
