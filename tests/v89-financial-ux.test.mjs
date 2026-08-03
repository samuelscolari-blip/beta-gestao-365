import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const cssPath = new URL("../app/v89-financial-ux.css", import.meta.url);
const layoutPath = new URL("../app/layout.tsx", import.meta.url);

test("a V89 é carregada depois da folha V88", async () => {
  const layout = await readFile(layoutPath, "utf8");
  const v88 = layout.indexOf('import "./v88-payroll-color-standard.css";');
  const v89 = layout.indexOf('import "./v89-financial-ux.css";');

  assert.ok(v88 >= 0);
  assert.ok(v89 > v88);
});

test("a central financeira compartilha uma única linguagem entre as abas", async () => {
  const css = await readFile(cssPath, "utf8");

  assert.match(css, /\.page-stack:has\(\.financial-center-tabs\)/);
  assert.match(css, /\.financial-center-tabs button\.active/);
  assert.match(css, /> \.mini-kpis article/);
  assert.match(css, /\.table-toolbar/);
  assert.match(css, /\.table-wrap th/);
  assert.match(css, /\.table-wrap td/);
  assert.match(css, /:is\(\.status-pill, \.v86-badge\)/);
});

test("o painel de custos usa mais área e tipografia maior", async () => {
  const css = await readFile(cssPath, "utf8");

  assert.match(css, /\.consolidated-card \.executive-cost-layout[\s\S]*padding:\s*14px 14px 12px/);
  assert.match(css, /\.consolidated-card \.cost-composition-card[\s\S]*min-height:\s*520px/);
  assert.match(css, /\.consolidated-card \.consolidated-summary span[\s\S]*font-size:\s*12px/);
  assert.match(css, /\.consolidated-card \.cost-bar-value strong[\s\S]*font-size:\s*18px/);
  assert.match(css, /\.consolidated-card \.cost-bar-track[\s\S]*height:\s*17px/);
});

test("os KPIs financeiros ficam legíveis sem trocar dados", async () => {
  const css = await readFile(cssPath, "utf8");

  assert.match(css, /> \.mini-kpis strong[\s\S]*font-size:\s*clamp\(30px, 2\.7vw, 40px\)/);
  assert.match(css, /> \.mini-kpis small[\s\S]*font-size:\s*12px/);
  assert.doesNotMatch(css, /content:\s*["'](?:0|R\$|Fornecedor|Aprovado|Pendente)/i);
});

test("a V89 preserva comportamento e não esconde ações", async () => {
  const css = await readFile(cssPath, "utf8");

  assert.doesNotMatch(css, /display:\s*none\s*!important/);
  assert.doesNotMatch(css, /pointer-events:\s*none/);
  assert.doesNotMatch(css, /position:\s*absolute/);
  assert.doesNotMatch(css, /visibility:\s*hidden/);
});

test("a reforma possui respostas para notebook e celular", async () => {
  const css = await readFile(cssPath, "utf8");

  assert.match(css, /@media \(max-width: 980px\)/);
  assert.match(css, /@media \(max-width: 720px\)/);
  assert.match(css, /\.financial-center-tabs button[\s\S]*width:\s*100%/);
  assert.match(css, /\.table-wrap[\s\S]*overflow-x:\s*auto/);
});
