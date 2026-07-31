import assert from "node:assert/strict";
import test from "node:test";
import {
  calculatePayroll,
  normalizePayrollInput,
  payrollRules2026,
} from "../../../packages/payroll-core/src/index";

test("o motor compartilhado produz memória determinística e custo patronal", () => {
  const input = normalizePayrollInput({
    employeeName: "Colaborador Teste",
    employeeCode: "TST-001",
    role: "Pedreiro",
    workName: "Obra Teste",
    competence: "2026-07",
    baseSalary: 3_500,
    monthlyHours: 220,
    overtimeHours: 10,
    overtimePercent: 50,
    additionalType: "HAZARD",
    insalubrityDegree: 20,
    insalubrityBase: payrollRules2026.minimumWage,
    taxableAdditions: 0,
    nonTaxableEarnings: 100,
    dependents: 1,
    pensionDeduction: 0,
    salaryAdvance: 0,
    consignments: 0,
    unionContribution: 0,
    otherDeductions: 0,
    fgtsCategory: "STANDARD",
    employerInssPercent: 20,
    ratPercent: 2,
    fapFactor: 1,
    thirdPartiesPercent: 5.8,
    employerParameterSource: "COMPANY_PROFILE",
  });

  const first = calculatePayroll(input);
  const second = calculatePayroll(input);

  assert.deepEqual(first, second);
  assert.equal(first.additionalAmount, 1_050);
  assert.equal(first.overtimeAmount, 238.64);
  assert.equal(first.gross, 4_888.64);
  assert.equal(first.fgts, 383.09);
  assert.ok(first.net > 0);
  assert.ok(first.totalEmployerCost > first.gross);
  assert.equal(first.rulesVersion, payrollRules2026.version);
  assert.ok(first.lines.some((line) => line.code === "90000"));
});
