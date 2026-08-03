import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const cssPath = new URL("../app/v92-rentals-admin-ux.css", import.meta.url);
const layoutPath = new URL("../app/layout.tsx", import.meta.url);

test("a V92 é carregada depois da V91", async () => {
  const layout = await readFile(layoutPath, "utf8");
  const v91 = layout.indexOf('import "./v91-clean-payroll-technical-ui.css";');
  const v92 = layout.indexOf('import "./v92-rentals-admin-ux.css";');

  assert.ok(v91 >= 0);
  assert.ok(v92 > v91);
});

test("a tabela de aluguéis usa uma escala tipográfica consistente", async () => {
  const css = await readFile(cssPath, "utf8");

  assert.match(css, /\.page-area:has\(\.v52-rental-management\) \.table-wrap thead th[\s\S]*font-size:\s*12px/);
  assert.match(css, /\.page-area:has\(\.v52-rental-management\) \.table-wrap tbody td[\s\S]*font-size:\s*14px/);
  assert.match(css, /\.v52-inline-detail[\s\S]*font-size:\s*13px/);
});

test("a coluna de status fica mais larga e não quebra o badge", async () => {
  const css = await readFile(cssPath, "utf8");

  assert.match(css, /th:nth-child\(4\),[\s\S]*td:nth-child\(4\)[\s\S]*min-width:\s*158px/);
  assert.match(css, /\.table-wrap \.status-pill[\s\S]*min-width:\s*112px/);
  assert.match(css, /\.table-wrap \.status-pill[\s\S]*font-size:\s*12px/);
  assert.match(css, /\.table-wrap \.status-pill[\s\S]*white-space:\s*nowrap/);
});

test("as Ações rápidas recebem cartões maiores e leitura melhor", async () => {
  const css = await readFile(cssPath, "utf8");

  assert.match(css, /\.v52-administrative-actions > div > button[\s\S]*min-height:\s*94px/);
  assert.match(css, /\.v52-administrative-actions button strong[\s\S]*font-size:\s*15px/);
  assert.match(css, /\.v52-administrative-actions button small[\s\S]*font-size:\s*13px/);
  assert.match(css, /button:focus-visible/);
});

test("somente o CTA redundante de Pessoas é retirado", async () => {
  const css = await readFile(cssPath, "utf8");

  assert.match(css, /\.page-area:has\(\.v52-administrative-actions\) \.module-heading \.button\.primary[\s\S]*display:\s*none/);
  assert.doesNotMatch(css, /(^|\n)\.module-heading \.button\.primary\s*\{/);
  assert.doesNotMatch(css, /\.v52-administrative-actions[^\n]*display:\s*none/);
});

test("a V92 não substitui dados nem altera regras de negócio", async () => {
  const css = await readFile(cssPath, "utf8");

  assert.doesNotMatch(css, /content:\s*["']/);
  assert.doesNotMatch(css, /pointer-events:\s*none/);
  assert.doesNotMatch(css, /position:\s*(?:absolute|fixed)/);
  assert.doesNotMatch(css, /Cadastrar funcionário|Cadastrar aluguel|R\$\s*\d/i);
});

test("as duas áreas continuam responsivas", async () => {
  const css = await readFile(cssPath, "utf8");

  assert.match(css, /@media \(max-width: 1200px\)/);
  assert.match(css, /grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /@media \(max-width: 720px\)/);
  assert.match(css, /grid-template-columns:\s*1fr/);
  assert.match(css, /overflow-x:\s*auto/);
});
