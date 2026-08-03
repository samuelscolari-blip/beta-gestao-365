import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const cssPath = new URL(
  "../app/v92-payroll-statement-redesign.css",
  import.meta.url,
);
const layoutPath = new URL("../app/layout.tsx", import.meta.url);

test("a V92 é carregada depois da limpeza técnica V91", async () => {
  const layout = await readFile(layoutPath, "utf8");
  const v91 = layout.indexOf('import "./v91-clean-payroll-technical-ui.css";');
  const v92 = layout.indexOf('import "./v92-payroll-statement-redesign.css";');

  assert.ok(v91 >= 0);
  assert.ok(v92 > v91);
});

test("a V92 fica isolada no extrato de pagamento da Folha", async () => {
  const css = await readFile(cssPath, "utf8");
  const selectors = css.match(/[^{}]+\{/g) || [];

  for (const rawSelector of selectors) {
    const selector = rawSelector.replace("{", "").trim();
    if (selector.startsWith("/*") || selector.startsWith("@")) continue;
    assert.match(selector, /^\.payment-statement:not\(\.termination-memory\)(?:\s|$)/);
  }
});

test("a V92 nunca alcança o extrato de Rescisão", async () => {
  const css = await readFile(cssPath, "utf8");

  assert.doesNotMatch(css, /\.termination-memory\s*\{/);
  assert.doesNotMatch(css, /,\s*\.termination-memory/);
});

test("a V92 não duplica estilo para blocos que a V91 já oculta", async () => {
  const css = await readFile(cssPath, "utf8");
  const selectors = css.match(/[^{}]+\{/g) || [];

  for (const rawSelector of selectors) {
    const selector = rawSelector.replace("{", "").trim();
    if (selector.startsWith("/*") || selector.startsWith("@")) continue;
    assert.doesNotMatch(selector, /\.statement-rules|\.payroll-warnings/);
  }
});

test("os totais do cálculo viram uma barra de destaque legível", async () => {
  const css = await readFile(cssPath, "utf8");

  assert.match(css, /tfoot td[\s\S]*border-top:\s*2px solid/);
  assert.match(css, /tfoot td:last-child[\s\S]*linear-gradient/);
  assert.match(css, /tfoot td:last-child strong[\s\S]*font-size:\s*19px/);
});

test("cada verba mantém um indicador de tipo sem esconder dados", async () => {
  const css = await readFile(cssPath, "utf8");

  assert.match(css, /--kind-accent/);
  assert.match(css, /statement-row td:first-child[\s\S]*box-shadow:\s*inset/);
  assert.doesNotMatch(css, /display:\s*none/);
  assert.doesNotMatch(css, /visibility:\s*hidden/);
  assert.doesNotMatch(css, /pointer-events:\s*none/);
});

test("a reforma responde ao celular sem cortar os totais", async () => {
  const css = await readFile(cssPath, "utf8");

  assert.match(css, /@media \(max-width: 720px\)[\s\S]*tfoot td/);
});
