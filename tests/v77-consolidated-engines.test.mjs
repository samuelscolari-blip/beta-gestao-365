import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("o motor financeiro centraliza total, parcial, comprovante e URL", async () => {
  const engine = await source("app/lib/payment-validation-engine.ts");
  assert.match(engine, /class PaymentValidationEngine/);
  assert.match(engine, /totalMonthly/);
  assert.match(engine, /monthlyRent/);
  assert.match(engine, /rentAmount/);
  assert.match(engine, /electricity/);
  assert.match(engine, /status Parcial/);
  assert.match(engine, /http:/);
  assert.match(engine, /https:/);

  const validation = await source("app/lib/record-validation.ts");
  assert.match(validation, /PaymentValidationEngine\.audit/);
});

test("o guardião fiscal exige credencial, protocolo, recibo e motivo", async () => {
  const guardian = await source("app/lib/fiscal-compliance-guardian.ts");
  assert.match(guardian, /certificateType/);
  assert.match(guardian, /certificateId/);
  assert.match(guardian, /powerOfAttorneyId/);
  assert.match(guardian, /batchProtocol/);
  assert.match(guardian, /receiptNumber/);
  assert.match(guardian, /rejectionReason/);

  const validation = await source("app/lib/record-validation.ts");
  assert.match(validation, /FiscalComplianceGuardian\.verify/);
});

test("o importador usa análise estrutural dinâmica e não mapa fixo de duas abas", async () => {
  const analyzer = await source("app/lib/sheet-analyzer.ts");
  assert.match(analyzer, /MIN_HEADER_SCORE/);
  assert.match(analyzer, /AMBIGUITY_RATIO/);
  assert.match(analyzer, /assessKnownSheet/);
  assert.doesNotMatch(analyzer, /05_CONTAS_PAGAR/);
  assert.doesNotMatch(analyzer, /CORE_HEADERS_MAP/);

  const spreadsheet = await source("app/lib/spreadsheet.ts");
  assert.match(spreadsheet, /SheetAnalyzer\.assessKnownSheet/);
  assert.match(spreadsheet, /SheetAnalyzer\.isAmbiguous/);
});

test("o auto-login local exige ambiente seguro e ativação explícita", async () => {
  const access = await source("app/lib/server-access.ts");
  assert.match(access, /process\.env\.NODE_ENV === "production"/);
  assert.match(access, /process\.env\.BETA_DEV_AUTO_LOGIN !== "1"/);
  assert.match(access, /host === "localhost"/);
  assert.match(access, /host === "127\.0\.0\.1"/);
  assert.match(access, /SOLE_ADMIN_EMAIL/);

  const app = await source("app/components/SecureBetaAppV66.tsx");
  assert.doesNotMatch(app, /admin@beta365\.local/);
  assert.doesNotMatch(app, /sys-admin-dev/);
});

test("administrador e modo público compartilham o mesmo painel de aprovados", async () => {
  const panel = await source("app/components/ApprovedRequestsPanel.tsx");
  assert.match(panel, /useMemo/);
  assert.match(panel, /Total liberado/);
  assert.match(panel, /v65-approved-list v77-approved-panel/);

  const admin = await source("app/components/SecureBetaAppV65.tsx");
  const publicMode = await source("app/components/SecureBetaAppV66.tsx");
  assert.match(admin, /ApprovedRequestsPanel/);
  assert.match(publicMode, /ApprovedRequestsPanel/);
  assert.match(admin, /approvedItems/);
  assert.match(publicMode, /approvedItems/);
});

test("campos financeiros auditados permanecem visíveis nos módulos V52", async () => {
  const corrections = await source("app/components/v52-module-corrections.ts");
  assert.match(corrections, /AUDITED_PAYMENT_FIELDS/);
  assert.match(corrections, /paymentStatus/);
  assert.match(corrections, /paymentDate/);
  assert.match(corrections, /paidAmount/);
  assert.match(corrections, /receiptUrl/);
  assert.match(corrections, /keepAuditedPaymentColumns\(rentals\)/);
});

test("a camada visual V77 é carregada por último", async () => {
  const layout = await source("app/layout.tsx");
  const v75 = layout.indexOf('import "./v75-demo-data.css";');
  const v77 = layout.indexOf('import "./v77-consolidated-engines.css";');
  assert.ok(v75 >= 0);
  assert.ok(v77 > v75);

  const css = await source("app/v77-consolidated-engines.css");
  assert.match(css, /v77-approved-grid/);
  assert.match(css, /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(css, /@media \(max-width: 640px\)/);
});
