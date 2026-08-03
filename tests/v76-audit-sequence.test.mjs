import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("a solução preserva o Dashboard real e usa a camada V74", async () => {
  const layout = await source("app/layout.tsx");
  const css = await source("app/v74-production-audit.css");
  assert.match(layout, /import "\.\/v74-production-audit\.css";/);
  assert.match(css, /construction-executive\.construction-executive-v2/);
  assert.match(css, /linear-gradient\(150deg, #062642 0%, #082f4b 52%, #0a3855 100%\)/);
});

test("timeline e indicadores seguem responsivos sem dados fixos", async () => {
  const css = await source("app/v74-production-audit.css");
  assert.match(css, /construction-stage-track/);
  assert.match(css, /grid-template-columns: repeat\(10, minmax\(0, 1fr\)\)/);
  assert.match(css, /grid-template-columns: repeat\(5, minmax\(0, 1fr\)\)/);
  assert.match(css, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /white-space: nowrap !important/);
  assert.match(css, /font-variant-numeric: tabular-nums/);
});

test("estado vazio da frota possui contraste e foco próprios", async () => {
  const css = await source("app/v74-production-audit.css");
  assert.match(css, /construction-machine-empty/);
  assert.match(css, /color: #85e3f1/);
  assert.match(css, /color: #b9d8e3/);
  assert.match(css, /outline: 3px solid rgba\(126, 226, 241, 0\.42\)/);
});

test("diagnóstico evita falso positivo e preserva proteções da PR 33", async () => {
  const diagnostic = await source("scripts/live-browser-diagnostic.mjs");
  assert.match(
    diagnostic,
    /state\.layout\?\.fleetRow && state\.layout\?\.fleetContrast < 4\.5/,
  );
  assert.match(diagnostic, /stylesheetReloadAttempted/);
  assert.match(diagnostic, /Folha de estilos não carregou/);
  assert.match(diagnostic, /removeDirectoryWithRetry/);
  assert.match(diagnostic, /ENOTEMPTY/);
  assert.match(diagnostic, /EBUSY/);
  assert.match(diagnostic, /EPERM/);
});

test("layout não volta a gerar fontes vinext inexistentes", async () => {
  const layout = await source("app/layout.tsx");
  assert.doesNotMatch(layout, /next\/font\/google/);
  assert.doesNotMatch(layout, /Geist(?:_Mono)?\(/);
  assert.match(layout, /ui-sans-serif/);
  assert.match(layout, /Segoe UI/);
});

test("dados fictícios permanecem na Central e nos Aprovados", async () => {
  const app = await source("app/components/BetaApp.tsx");
  const admin = await source("app/components/SecureBetaAppV65.tsx");
  const publicMode = await source("app/components/SecureBetaAppV66.tsx");
  assert.match(app, /function isManagementRequest\(record: StoredRecord\)/);
  assert.doesNotMatch(app, /function isRealManagementRequest/);
  assert.doesNotMatch(admin, /function isRealRecord/);
  assert.doesNotMatch(publicMode, /function isRealRecord/);
  assert.match(app, /Registros na fila/);
  assert.match(app, /Dados de teste/);
  assert.match(app, /Valor total da fila/);
});

test("a revisão enumerada permanece salva junto ao código", async () => {
  const audit = await source("docs/auditoria-sequencia-pos-producao-v76.md");
  for (const heading of [
    "Substituição completa da função `Dashboard`",
    "Painel executivo em uma superfície escura contínua",
    "Contraste do estado vazio da frota",
    "Falso positivo do contraste quando não existe linha de frota",
    "Cache transitório de CSS após deploy",
    "Dados fictícios desaparecendo da Central e dos Aprovados",
  ]) {
    assert.match(audit, new RegExp(heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});
