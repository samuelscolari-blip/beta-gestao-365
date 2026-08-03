import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("item 14 separates work, landlord document and payment fields", async () => {
  const route = await source("app/api/records/route.ts");
  const secure = await source("app/components/SecureBetaAppV52.tsx");
  const form = await source("app/components/BetaAppV52.tsx");
  assert.doesNotMatch(route, /payload\.work = firstNonBlank\([\s\S]*landlordDocument/);
  assert.match(route, /"landlordDocument"/);
  assert.match(secure, /looksLikeBrazilianDocument/);
  assert.match(form, /"paymentStatus",[\s\S]*"paymentDate",[\s\S]*"paidAmount",[\s\S]*"receiptUrl"/);
});

test("item 14 blocks underpayment and calculates the rental total", async () => {
  const validation = await source("app/lib/record-validation.ts");
  const engine = await source("app/lib/payment-validation-engine.ts");
  assert.match(validation, /PaymentValidationEngine\.audit/);
  assert.match(engine, /paidAmount < expectedAmount - 0\.01/);
  assert.match(engine, /firstPositiveAlias\(payload, \["monthlyRent", "rentAmount"\]\)/);
  assert.match(engine, /numberValue\(payload, "internet"\)/);
  assert.match(engine, /firstPositiveAlias\(payload, \["energy", "electricity"\]\)/);
});

test("item 16 requires certificate for successful processing", async () => {
  const validation = await source("app/lib/record-validation.ts");
  const guardian = await source("app/lib/fiscal-compliance-guardian.ts");
  assert.match(validation, /FiscalComplianceGuardian\.verify/);
  assert.match(guardian, /"Processado com sucesso"/);
  assert.match(guardian, /certificateType/);
  assert.match(guardian, /certificateId/);
  assert.match(guardian, /powerOfAttorneyId/);
  assert.match(guardian, /receiptNumber/);
});

test("item 18 shares content detection and blocks ambiguity", async () => {
  const spreadsheet = await source("app/lib/spreadsheet.ts");
  const analyzer = await source("app/lib/sheet-analyzer.ts");
  const preflight = await source("app/lib/import-preflight-v65.ts");
  assert.match(spreadsheet, /export function resolveImportSheet/);
  assert.match(spreadsheet, /SheetAnalyzer\.assessKnownSheet/);
  assert.match(spreadsheet, /SheetAnalyzer\.isAmbiguous/);
  assert.match(analyzer, /AMBIGUITY_RATIO = 0\.82/);
  assert.match(analyzer, /MIN_HEADER_SCORE = 2/);
  assert.match(preflight, /Escolha manual do módulo necessária/);
  assert.match(preflight, /kind: "error"/);
});

test("item 21 does not equate paid with approved", async () => {
  const route = await source("app/api/records/route.ts");
  const decisions = await source("app/lib/approved-decisions.ts");
  const admin = await source("app/components/SecureBetaAppV65.tsx");
  const publicView = await source("app/components/SecureBetaAppV66.tsx");
  assert.doesNotMatch(route, /statusText\.includes\("pag"\)/);
  assert.doesNotMatch(decisions, /"pago"|"paga"/);
  assert.match(decisions, /"aprovado", "aprovada"/);
  assert.match(admin, /approvedDecisionModules/);
  assert.match(publicView, /approvedDecisionModules/);
  assert.match(admin, /ApprovedRequestsPanel/);
  assert.match(publicView, /ApprovedRequestsPanel/);
});
