import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const cssPath = new URL("../app/v88-payroll-color-standard.css", import.meta.url);
const layoutPath = new URL("../app/layout.tsx", import.meta.url);

test("a paleta V88 é carregada depois das camadas visuais anteriores", async () => {
  const layout = await readFile(layoutPath, "utf8");
  const v86 = layout.indexOf('import "./v86-machine-priority-responsive.css";');
  const v88 = layout.indexOf('import "./v88-payroll-color-standard.css";');

  assert.ok(v86 >= 0);
  assert.ok(v88 > v86);
});

test("a V88 fica isolada na tela de folha", async () => {
  const css = await readFile(cssPath, "utf8");
  const selectors = css.match(/[^{}]+\{/g) || [];

  for (const rawSelector of selectors) {
    const selector = rawSelector.replace("{", "").trim();
    if (selector.startsWith("/*") || selector.startsWith("@")) continue;
    assert.match(selector, /^\.payroll-page(?:\s|$)/);
  }
});

test("o enquadramento da empresa deixa de usar superfície escura", async () => {
  const css = await readFile(cssPath, "utf8");

  assert.match(css, /\.payroll-page \.company-tax-profile \.tax-profile-main/);
  assert.match(css, /border-left:\s*5px solid #63c7df/);
  assert.match(css, /linear-gradient\(135deg, #eef9fc 0%, #f8fcfd 68%, #ffffff 100%\)/);
  assert.doesNotMatch(css, /#17384d|#225f6c|#6340bf|#6d28d9|#5b21b6/);
});

test("o cabeçalho e o processamento usam a paleta administrativa azul", async () => {
  const css = await readFile(cssPath, "utf8");

  assert.match(css, /\.payroll-page \.payroll-heading/);
  assert.match(css, /\.payroll-page \.batch-icon/);
  assert.match(css, /#72d0e6/);
  assert.match(css, /#eaf7fb/);
});

test("a camada declara explicitamente que não altera estrutura", async () => {
  const css = await readFile(cssPath, "utf8");

  assert.doesNotMatch(css, /grid-template-columns|grid-template-areas|position:\s*absolute|width:\s*\d+px|height:\s*\d+px/);
});
