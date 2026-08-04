import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const wrapperPath = new URL(
  "../app/components/SecureBetaAppV99.tsx",
  import.meta.url,
);
const cssPath = new URL("../app/v99-unified-machines.css", import.meta.url);
const pagePath = new URL("../app/page.tsx", import.meta.url);
const layoutPath = new URL("../app/layout.tsx", import.meta.url);

test("V99 ativa a tela unificada de Máquinas preservando V97", async () => {
  const wrapper = await readFile(wrapperPath, "utf8");
  const page = await readFile(pagePath, "utf8");

  assert.match(wrapper, /import SecureBetaAppV97/);
  assert.match(wrapper, /return <SecureBetaAppV97/);
  assert.match(page, /SecureBetaAppV99/);
});

test("o painel duplicado é removido e a tabela recebe impacto e parada", async () => {
  const wrapper = await readFile(wrapperPath, "utf8");
  const css = await readFile(cssPath, "utf8");

  assert.match(css, /\.machine-command-grid\s*\{[\s\S]*display:\s*none\s*!important/);
  assert.match(css, /\.mini-kpis\s*\{[\s\S]*display:\s*none\s*!important/);
  assert.match(wrapper, /IMPACTO NO PERÍODO/);
  assert.match(wrapper, /PARADA \/ PERDA/);
  assert.match(wrapper, /machine-row-finance strong/);
  assert.match(wrapper, /machine-row-main small/);
});

test("todas as máquinas continuam visíveis mesmo sem ocorrência na competência", async () => {
  const wrapper = await readFile(wrapperPath, "utf8");

  assert.match(wrapper, /Sem ocorrência adicional vinculada/);
  assert.match(wrapper, /Sem perda calculada na competência/);
  assert.match(wrapper, /findMachineTable/);
  assert.doesNotMatch(wrapper, /slice\(0,\s*6\)/);
});

test("a camada visual V99 é carregada por último", async () => {
  const layout = await readFile(layoutPath, "utf8");

  assert.match(layout, /v98-vacations-ui\.css";\nimport "\.\/v99-unified-machines\.css";/);
});
