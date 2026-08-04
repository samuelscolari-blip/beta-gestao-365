import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const cssPath = new URL("../app/v94-global-header-standard.css", import.meta.url);
const layoutPath = new URL("../app/layout.tsx", import.meta.url);

test("a V94 é carregada depois do cabeçalho financeiro aprovado V93", async () => {
  const layout = await readFile(layoutPath, "utf8");
  const v93 = layout.indexOf('import "./v93-financial-header-approved.css";');
  const v94 = layout.indexOf('import "./v94-global-header-standard.css";');

  assert.ok(v93 >= 0);
  assert.ok(v94 > v93);
});

test("os demais cabeçalhos usam a mesma estrutura executiva clara", async () => {
  const css = await readFile(cssPath, "utf8");

  assert.match(css, /\.page-stack:not\(:has\(\.financial-center-tabs\)\) > \.module-heading\s*\{/);
  assert.match(css, /grid-template-columns:\s*minmax\(0, 1fr\) auto/);
  assert.match(css, /linear-gradient\(135deg, #ffffff 0%, #fbfdff 58%, #eff8ff 100%\)/);
  assert.match(css, /border-radius:\s*26px/);
  assert.match(css, /box-shadow:[\s\S]*rgba\(30, 83, 127, 0\.11\)/);
});

test("título, descrição e ícone têm contraste e escala padronizados", async () => {
  const css = await readFile(cssPath, "utf8");

  assert.match(css, /\.module-heading h1[\s\S]*color:\s*#071d55/);
  assert.match(css, /\.module-heading h1[\s\S]*font-size:\s*clamp\(31px, 2\.55vw, 43px\)/);
  assert.match(css, /\.module-heading p[\s\S]*color:\s*#5d6f82/);
  assert.match(css, /\.module-big-icon[\s\S]*width:\s*78px/);
  assert.match(css, /\.module-big-icon[\s\S]*border-radius:\s*21px/);
});

test("ações principais e secundárias seguem um único padrão", async () => {
  const css = await readFile(cssPath, "utf8");

  assert.match(css, /\.module-heading \.button\s*\{[\s\S]*min-height:\s*52px/);
  assert.match(css, /\.button\.primary[\s\S]*linear-gradient\(135deg, var\(--module-accent\)/);
  assert.match(css, /\.button:not\(\.primary\)[\s\S]*background:\s*rgba\(255, 255, 255, 0\.9\)/);
  assert.match(css, /:focus-visible/);
});

test("Folha, Compliance, Administração e Impostos preservam acentos semânticos", async () => {
  const css = await readFile(cssPath, "utf8");

  assert.match(css, /\.module-heading\.compliance-heading[\s\S]*--module-accent:\s*#0f766e/);
  assert.match(css, /\.module-heading\.payroll-heading[\s\S]*--module-accent:\s*#6546c8/);
  assert.match(css, /\.module-heading\.admin-heading[\s\S]*--module-accent:\s*#7b42c7/);
  assert.match(css, /\.module-heading\.tax-heading[\s\S]*--module-accent:\s*#b8610b/);
});

test("a V94 não sobrescreve o cabeçalho financeiro aprovado", async () => {
  const css = await readFile(cssPath, "utf8");

  assert.doesNotMatch(css, /\.page-stack:has\(\.financial-center-tabs\) > \.module-heading/);
  assert.match(css, /not\(:has\(\.financial-center-tabs\)\)/);
});

test("a padronização permanece somente visual", async () => {
  const css = await readFile(cssPath, "utf8");

  assert.doesNotMatch(css, /content:\s*["'][^"']+["']/);
  assert.doesNotMatch(css, /display:\s*none/);
  assert.doesNotMatch(css, /pointer-events:\s*none/);
  assert.doesNotMatch(css, /Cadastrar|Central Financeira|Folha de Pagamento/);
});

test("o padrão responde a notebook, tablet e celular", async () => {
  const css = await readFile(cssPath, "utf8");

  assert.match(css, /@media \(max-width: 1100px\)/);
  assert.match(css, /grid-template-columns:\s*1fr/);
  assert.match(css, /@media \(max-width: 720px\)/);
  assert.match(css, /width:\s*100%/);
  assert.match(css, /@media \(max-width: 480px\)/);
});