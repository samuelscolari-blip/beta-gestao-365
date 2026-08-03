import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const cssPath = new URL("../app/v93-financial-header-approved.css", import.meta.url);
const layoutPath = new URL("../app/layout.tsx", import.meta.url);

test("a V93 é carregada depois da V92", async () => {
  const layout = await readFile(layoutPath, "utf8");
  const v92 = layout.indexOf('import "./v92-rentals-admin-ux.css";');
  const v93 = layout.indexOf('import "./v93-financial-header-approved.css";');

  assert.ok(v92 >= 0);
  assert.ok(v93 > v92);
});

test("o cabeçalho financeiro usa fundo claro e contraste executivo", async () => {
  const css = await readFile(cssPath, "utf8");
  const titleBlock = css.match(
    /\.page-stack:has\(\.financial-center-tabs\) > \.module-heading h1\s*\{([\s\S]*?)\}/,
  )?.[1] || "";

  assert.match(css, /\.page-stack:has\(\.financial-center-tabs\) > \.module-heading[\s\S]*linear-gradient\(135deg, #ffffff/);
  assert.match(titleBlock, /color:\s*#071d55/);
  assert.match(css, /\.module-heading p[\s\S]*color:\s*#5d6f82/);
  assert.doesNotMatch(titleBlock, /color:\s*#ffffff/);
});

test("ícone, breadcrumb e botão seguem o visual aprovado", async () => {
  const css = await readFile(cssPath, "utf8");

  assert.match(css, /\.module-big-icon[\s\S]*width:\s*92px/);
  assert.match(css, /\.module-big-icon[\s\S]*border-radius:\s*24px/);
  assert.match(css, /\.module-heading \.eyebrow[\s\S]*color:\s*#1477c9/);
  assert.match(css, /\.button\.primary[\s\S]*min-height:\s*58px/);
  assert.match(css, /\.button\.primary[\s\S]*linear-gradient\(135deg, #138df2/);
  assert.match(css, /:focus-visible/);
});

test("a correção permanece isolada na Central Financeira", async () => {
  const css = await readFile(cssPath, "utf8");

  const selectors = css.match(/\.page-stack:has\(\.financial-center-tabs\)/g) || [];
  assert.ok(selectors.length >= 12);
  assert.doesNotMatch(css, /(^|\n)\.module-heading\s*\{/);
  assert.doesNotMatch(css, /(^|\n)\.module-big-icon\s*\{/);
});

test("a V93 não altera conteúdo, regras ou interações", async () => {
  const css = await readFile(cssPath, "utf8");

  assert.doesNotMatch(css, /content:\s*["']/);
  assert.doesNotMatch(css, /display:\s*none/);
  assert.doesNotMatch(css, /pointer-events:\s*none/);
  assert.doesNotMatch(css, /Cadastrar pagamento|Central Financeira e Fornecedores/);
});

test("o cabeçalho aprovado continua responsivo", async () => {
  const css = await readFile(cssPath, "utf8");

  assert.match(css, /@media \(max-width: 1100px\)/);
  assert.match(css, /grid-template-columns:\s*1fr/);
  assert.match(css, /@media \(max-width: 720px\)/);
  assert.match(css, /width:\s*100%/);
  assert.match(css, /@media \(max-width: 480px\)/);
});