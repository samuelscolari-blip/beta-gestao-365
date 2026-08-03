import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const cssPath = new URL("../app/v91-clean-payroll-technical-ui.css", import.meta.url);
const layoutPath = new URL("../app/layout.tsx", import.meta.url);
const payrollPath = new URL("../app/components/BetaApp.tsx", import.meta.url);
const terminationPath = new URL("../app/components/TerminationStudio.tsx", import.meta.url);

test("a V91 é carregada depois da V90", async () => {
  const layout = await readFile(layoutPath, "utf8");
  const v90 = layout.indexOf('import "./v90-payroll-result-colors.css";');
  const v91 = layout.indexOf('import "./v91-clean-payroll-technical-ui.css";');

  assert.ok(v90 >= 0);
  assert.ok(v91 > v90);
});

test("folha e rescisão deixam de exibir regras detalhadas e avisos repetitivos", async () => {
  const css = await readFile(cssPath, "utf8");

  assert.match(css, /\.payroll-page \.statement-rules,[\s\S]*\.payroll-page \.payroll-warnings[\s\S]*display:\s*none\s*!important/);
});

test("a tela de rescisão deixa de exibir manual e portais oficiais", async () => {
  const css = await readFile(cssPath, "utf8");

  assert.match(css, /\.termination-page \.termination-mos-strip,[\s\S]*\.termination-page \.termination-official-sources[\s\S]*display:\s*none\s*!important/);
});

test("a limpeza não remove históricos, valores ou motores de cálculo", async () => {
  const [css, payroll, termination] = await Promise.all([
    readFile(cssPath, "utf8"),
    readFile(payrollPath, "utf8"),
    readFile(terminationPath, "utf8"),
  ]);

  assert.doesNotMatch(css, /saved-previews/);
  assert.doesNotMatch(css, /payroll-summary-grid/);
  assert.doesNotMatch(css, /payroll-memory/);
  assert.match(payroll, /calculatePayroll/);
  assert.match(termination, /calculateTermination/);
  assert.match(payroll, /className="content-card saved-previews"/);
  assert.match(termination, /className="content-card saved-previews"/);
});
