import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const app = await readFile("app/components/BetaApp.tsx", "utf8");
const layout = await readFile("app/layout.tsx", "utf8");
const css = await readFile("app/construction-executive-v59.css", "utf8");

test("V59 keeps the executive construction panel connected to real data", () => {
  assert.match(app, /currency\.format\(projectedFinalCost\)/);
  assert.match(app, /currency\.format\(estimatedCostToComplete\)/);
  assert.match(app, /<h3>\{currentStage\}<\/h3>/);
  assert.match(app, /\{ownTeamCount\}/);
  assert.doesNotMatch(app, /R\$ 1\.290\.000,00/);
  assert.doesNotMatch(app, /Gestor Teste 01/);
});

test("V59 consolidates the approved visual identity", () => {
  assert.match(layout, /construction-executive-v59\.css/);
  assert.match(css, /--construction-navy-950: #062642/);
  assert.match(css, /--construction-panel:/);
  assert.match(css, /\.construction-stage-roadmap/);
  assert.match(css, /\.construction-dashboard-v56/);
  assert.match(css, /\.construction-workforce-card/);
  assert.match(css, /\.construction-fleet-v2/);
});

test("V59 protects readability, long values and responsive layouts", () => {
  assert.match(css, /overflow-wrap: anywhere/);
  assert.match(css, /font-size: clamp\(29px, 3vw, 42px\)/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /grid-template-columns: 1fr/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion: reduce/);
});
