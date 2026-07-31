import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  IBS_CBS_DEFAULTS,
  calculateAssessment,
  calculateIbsCbs,
  validateFiscalDocument,
} from "../app/lib/ibs-cbs.js";

test("Teste 1: aquisição de R$ 10.000 calcula IBS 10 e CBS 90", () => {
  const result = calculateIbsCbs({
    operationValue: 10000,
    direction: "incoming",
    competence: "2026-01",
    creditEligible: true,
    ibsStateRate: 0.1,
    ibsMunicipalRate: 0,
    cbsRate: 0.9,
  });
  assert.equal(result.ibsStateRate, 0.1);
  assert.equal(result.ibsMunicipalRate, 0);
  assert.equal(result.ibsAmount, 10);
  assert.equal(result.cbsAmount, 90);
  assert.equal(result.totalAmount, 100);
  assert.equal(result.creditAmount, 100);
});

test("Teste 2: receita de serviço de R$ 25.000 calcula IBS 25 e CBS 225", () => {
  const result = calculateIbsCbs({
    operationValue: 25000,
    direction: "outgoing",
    competence: "2026-01",
    ibsStateRate: 0.1,
    ibsMunicipalRate: 0,
    cbsRate: 0.9,
  });
  assert.equal(result.ibsAmount, 25);
  assert.equal(result.cbsAmount, 225);
  assert.equal(result.totalAmount, 250);
  assert.equal(result.creditAmount, 0);
});

test("documento incompleto fica bloqueado para fechamento", () => {
  const result = validateFiscalDocument(
    { operationValue: 1000, competence: "2026-07" },
    { ibsStateRate: 0.1, ibsMunicipalRate: 0, cbsRate: 0.9 },
    [],
  );
  assert.equal(result.status, "Bloqueado para fechamento");
  assert.ok(result.criticalCount >= 4);
});

test("apuração separa débitos, créditos e créditos bloqueados", () => {
  const assessment = calculateAssessment(
    [
      {
        competence: "2026-07",
        direction: "outgoing",
        ibsAmount: 25,
        cbsAmount: 225,
        creditEligible: false,
        complianceStatus: "Conforme",
        criticalCount: 0,
      },
      {
        competence: "2026-07",
        direction: "incoming",
        ibsAmount: 10,
        cbsAmount: 90,
        creditEligible: true,
        complianceStatus: "Conforme",
        criticalCount: 0,
      },
      {
        competence: "2026-07",
        direction: "incoming",
        ibsAmount: 2,
        cbsAmount: 18,
        creditEligible: false,
        complianceStatus: "Pendente de conferência",
        criticalCount: 0,
      },
    ],
    "2026-07",
  );
  assert.equal(assessment.ibsDebits, 25);
  assert.equal(assessment.ibsCredits, 10);
  assert.equal(assessment.cbsDebits, 225);
  assert.equal(assessment.cbsCredits, 90);
  assert.equal(assessment.blockedCredits, 20);
  assert.equal(assessment.pendingDocuments, 1);
});

test("alíquotas explicitamente zeradas permanecem zeradas", () => {
  const result = calculateIbsCbs({
    operationValue: 10000,
    direction: "outgoing",
    competence: "2026-07",
    ibsStateRate: 0,
    ibsMunicipalRate: 0,
    cbsRate: 0,
  });
  assert.equal(result.ibsAmount, 0);
  assert.equal(result.cbsAmount, 0);
  assert.equal(result.totalAmount, 0);
});

test("configuração pode bloquear o aproveitamento de crédito", () => {
  const result = calculateIbsCbs({
    operationValue: 10000,
    direction: "incoming",
    competence: "2026-07",
    ibsStateRate: 0.1,
    ibsMunicipalRate: 0,
    cbsRate: 0.9,
    creditEligible: true,
    creditEnabled: false,
  });
  assert.equal(result.creditAmount, 0);
  assert.equal(result.blockedCredit, 100);
});

test("Simples Nacional em 2026 fica marcado como não aplicável", () => {
  const result = validateFiscalDocument(
    {
      fiscalKey: "12345678901234567890123456789012345678901234",
      operationValue: 1000,
      competence: "2026-07",
      issueDate: "2026-07-15",
      supplierTaxRegime: "Simples Nacional",
      work: "Obra teste",
      documentUrl: "https://example.invalid/doc",
    },
    {
      regime: "Simples Nacional",
      incidenceEnabled: true,
      effectiveFrom: "2026-01-01",
      effectiveTo: "2026-12-31",
      ibsStateRate: 0.1,
      ibsMunicipalRate: 0,
      cbsRate: 0.9,
    },
    [],
  );
  assert.equal(result.applicable, false);
  assert.equal(result.calculation.totalAmount, 0);
  assert.equal(result.status, "Não aplicável");
});

test("parâmetros oficiais de teste de 2026 separam IBS UF e municipal", () => {
  assert.equal(IBS_CBS_DEFAULTS.ibsStateRate, 0.1);
  assert.equal(IBS_CBS_DEFAULTS.ibsMunicipalRate, 0);
  assert.equal(IBS_CBS_DEFAULTS.ibsRate, 0.1);
  assert.equal(IBS_CBS_DEFAULTS.cbsRate, 0.9);
});

test("CST e cClassTrib incompatíveis bloqueiam o documento", () => {
  const result = validateFiscalDocument(
    {
      fiscalKey: "12345678901234567890123456789012345678901234",
      operationValue: 1000,
      competence: "2026-07",
      issueDate: "2026-07-15",
      supplierTaxRegime: "Regime regular",
      work: "Obra teste",
      documentUrl: "https://example.invalid/doc",
      itemCode: "12345678",
      cst: "000",
      cClassTrib: "200001",
    },
    IBS_CBS_DEFAULTS,
    [],
  );
  assert.equal(result.status, "Bloqueado para fechamento");
  assert.ok(
    result.issues.some((issue) => issue.code === "CCLASSTRIB_CST_MISMATCH"),
  );
});

test("folha não cria rubrica ou desconto de IBS/CBS", () => {
  const payrollSource = readFileSync(new URL("../app/lib/payroll.ts", import.meta.url), "utf8");
  assert.doesNotMatch(payrollSource, /\bIBS\b|\bCBS\b/i);
});
