import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const cssPath = new URL("../app/v90-payroll-result-colors.css", import.meta.url);
const layoutPath = new URL("../app/layout.tsx", import.meta.url);

test("a V90 é carregada depois das camadas anteriores", async () => {
  const layout = await readFile(layoutPath, "utf8");
  const v89 = layout.indexOf('import "./v89-financial-ux.css";');
  const v90 = layout.indexOf('import "./v90-payroll-result-colors.css";');

  assert.ok(v89 >= 0);
  assert.ok(v90 > v89);
});

test("o líquido da folha usa verde claro com texto e valor pretos", async () => {
  const css = await readFile(cssPath, "utf8");

  assert.match(css, /\.payroll-page:not\(\.termination-page\)[\s\S]*#e8f7ec[\s\S]*#dff3e5/);
  assert.match(css, /\.payroll-page:not\(\.termination-page\)[\s\S]*\.net-result span,[\s\S]*\.net-result strong[\s\S]*color:\s*#111111/);
});

test("o líquido rescisório usa vermelho claro com texto e valor pretos", async () => {
  const css = await readFile(cssPath, "utf8");

  assert.match(css, /\.termination-page[\s\S]*#fdeaea[\s\S]*#f8dede/);
  assert.match(css, /\.termination-page[\s\S]*\.net-result span,[\s\S]*\.net-result strong[\s\S]*color:\s*#111111/);
});

test("a V90 não altera estrutura ou comportamento", async () => {
  const css = await readFile(cssPath, "utf8");

  assert.doesNotMatch(css, /display\s*:/);
  assert.doesNotMatch(css, /position\s*:/);
  assert.doesNotMatch(css, /grid-template/);
  assert.doesNotMatch(css, /width\s*:/);
  assert.doesNotMatch(css, /height\s*:/);
  assert.doesNotMatch(css, /pointer-events/);
});
