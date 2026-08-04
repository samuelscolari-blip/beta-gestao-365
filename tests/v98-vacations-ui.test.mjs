import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const layoutPath = new URL("../app/layout.tsx", import.meta.url);
const wrapperPath = new URL(
  "../app/components/SecureBetaAppV97.tsx",
  import.meta.url,
);
const cssPath = new URL("../app/v98-vacations-ui.css", import.meta.url);

test("a correção visual de férias é carregada depois das camadas anteriores", async () => {
  const layout = await readFile(layoutPath, "utf8");

  assert.match(
    layout,
    /v96-central-pedidos-contrast\.css[\s\S]*v98-vacations-ui\.css/,
  );
});

test("a tela de férias recebe marcador próprio sem alcançar outros módulos", async () => {
  const wrapper = await readFile(wrapperPath, "utf8");

  assert.match(wrapper, /function markVacationsPage\(\)/);
  assert.match(wrapper, /"Cálculo de Férias"/);
  assert.match(wrapper, /classList\.add\("vacations-page"\)/);
});

test("o topo azul e a remoção do CTA ficam restritos à tela de férias", async () => {
  const css = await readFile(cssPath, "utf8");

  assert.match(css, /\.page-stack\.vacations-page > \.module-heading/);
  assert.match(css, /linear-gradient\(135deg, #082b46/);
  assert.match(css, /\.page-stack\.vacations-page \.empty-actions\s*\{[\s\S]*display:\s*none\s*!important/);
  assert.doesNotMatch(css, /(^|\n)\.module-heading\s*\{/);
});
