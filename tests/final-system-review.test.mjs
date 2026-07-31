import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const app = await readFile("app/components/BetaApp.tsx", "utf8");
const v52 = await readFile("app/components/BetaAppV52.tsx", "utf8");
const route = await readFile("app/api/records/route.ts", "utf8");
const records = await readFile("db/records.ts", "utf8");
const css = await readFile("app/globals.css", "utf8");
const constructionCss = await readFile("app/construction-v56.css", "utf8");

test("financial center has the three requested tabs", () => {
  assert.match(app, /Contas a pagar/);
  assert.match(app, /Fornecedores/);
  assert.match(app, /Aprovados/);
  assert.match(app, /financial-center-tabs/);
});

test("expenses only expose the requested statuses", () => {
  assert.match(v52, /options: \["Aguardando validação", "Reprovado", "Pago"\]/);
  assert.match(route, /Aguardando validação/);
  assert.match(route, /Lançamento bloqueado: anexe a nota fiscal/);
  assert.match(route, /CPF ou CNPJ do fornecedor/);
  assert.match(records, /pendingStatusBackfills/);
});

test("construction dashboard is compact and has no repeated finance section", () => {
  const roadmap = app.indexOf('className="construction-stage-roadmap"');
  const dashboard = app.indexOf('className="construction-dashboard-v56"');
  assert.ok(roadmap >= 0 && dashboard >= 0 && roadmap < dashboard);
  assert.match(app, /construction-kpi-row-v56/);
  assert.match(app, /construction-main-grid-v56/);
  assert.match(app, /construction-stage-card-v56/);
  assert.match(app, /construction-budget-card-v56/);
  assert.doesNotMatch(app, /className={`construction-project-command/);
  assert.doesNotMatch(app, /construction-capacity-compact/);
  assert.doesNotMatch(app, /construction-finance-summary/);
  assert.doesNotMatch(app, /className={`construction-project-finance/);
  assert.match(constructionCss, /grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(constructionCss, /grid-template-columns: minmax\(0, 2fr\) minmax\(320px, 1fr\)/);
  assert.match(css, /Revisão executiva V53/);
});

test("removed dashboard sections stay removed", () => {
  assert.doesNotMatch(app, /cost-monitor-progress/);
  assert.doesNotMatch(app, /management-training/);
  assert.doesNotMatch(app, /content-card quick-card action-center/);
});
