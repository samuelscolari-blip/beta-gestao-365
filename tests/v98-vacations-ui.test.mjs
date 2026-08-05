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

  /*
   * O topo azul próprio de Férias saiu na etapa 5D, e a linha de base
   * confirmou que a tela não mudou: desde a 5A o cabeçalho já não
   * carregava `.module-heading`, então aquelas regras não aplicavam
   * havia tempo — eram tinta em cima de tinta que ninguém via.
   *
   * O ajuste que continua valendo é o outro: esconder o bloco de ações
   * vazio, que não depende do cabeçalho.
   */
  assert.doesNotMatch(
    css.replace(/\/\*[\s\S]*?\*\//g, ""),
    /\.module-heading/,
    "O cabeçalho pertence ao seu CSS Module.",
  );
  assert.match(css, /\.page-stack\.vacations-page \.empty-actions\s*\{[\s\S]*display:\s*none\s*!important/);
});
