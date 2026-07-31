import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  calculatePayroll,
  calculateProgressiveInss,
  normalizePayrollInput,
  payrollRules2026,
  validatePayrollInput,
} from "../app/lib/payroll.ts";

function input(overrides = {}) {
  return normalizePayrollInput({
    employeeName: "Colaborador de teste",
    employeeCode: "TST-001",
    role: "Eletricista",
    workName: "Obra teste",
    competence: "2026-07",
    baseSalary: 3000,
    monthlyHours: 220,
    overtimeHours: 0,
    overtimePercent: 50,
    additionalType: "NONE",
    insalubrityDegree: 20,
    insalubrityBase: payrollRules2026.minimumWage,
    taxableAdditions: 0,
    nonTaxableEarnings: 0,
    dependents: 0,
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
    ...overrides,
  });
}

test("uses the progressive INSS brackets effective in 2026", () => {
  assert.equal(calculateProgressiveInss(1621), 121.58);
  assert.equal(calculateProgressiveInss(5000), 501.51);
  assert.equal(
    calculateProgressiveInss(100_000),
    calculateProgressiveInss(payrollRules2026.inssCeiling),
  );
});

test("applies the 2026 monthly IRRF reduction through R$ 5,000", () => {
  const result = calculatePayroll(input({ baseSalary: 5000 }));
  assert.equal(result.irrfBeforeReduction > 0, true);
  assert.equal(result.irrfReduction, result.irrfBeforeReduction);
  assert.equal(result.irrf, 0);
});

test("calculates construction additions, FGTS category and RAT times FAP", () => {
  const result = calculatePayroll(
    input({
      additionalType: "HAZARD",
      fgtsCategory: "APPRENTICE",
      fapFactor: 1.5,
    }),
  );
  assert.equal(result.additionalAmount, 900);
  assert.equal(result.taxableGross, 3900);
  assert.equal(result.fgtsRate, 0.02);
  assert.equal(result.fgts, 78);
  assert.equal(result.ratAdjustedPercent, 3);
  assert.equal(result.ratAdjusted, 117);
});

test("keeps insalubrity configurable and flags overtime below the general minimum", () => {
  const normalized = input({
    additionalType: "INSALUBRITY",
    insalubrityDegree: 20,
    overtimeHours: 2,
    overtimePercent: 40,
  });
  const result = calculatePayroll(normalized);
  assert.equal(result.additionalAmount, 324.2);
  assert.match(
    validatePayrollInput(normalized).join(" "),
    /inferior ao mínimo geral de 50%/i,
  );
  assert.equal(
    result.warnings.some((warning) => /abaixo do mínimo geral/i.test(warning)),
    true,
  );
});

test("keeps the employer estimate when the company profile is still blank", async () => {
  const route = await readFile(
    new URL("../app/api/payroll-preview/route.ts", import.meta.url),
    "utf8",
  );
  const component = await readFile(
    new URL("../app/components/BetaApp.tsx", import.meta.url),
    "utf8",
  );

  assert.match(route, /if \(!normalized\) return null/);
  assert.match(component, /if \(!normalized\) return fallback/);
});
