import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateTermination,
  normalizeTerminationInput,
  terminationRules2026,
  validateTerminationInput,
} from "../app/lib/termination.ts";
import { runTerminationValidationSuite } from "../app/lib/termination-validation.ts";

function input(overrides = {}) {
  return normalizeTerminationInput({
    employeeRecordId: 10,
    employeeName: "Colaborador de teste",
    employeeCode: "TST-RES-001",
    role: "Eletricista",
    admissionDate: "2024-02-10",
    terminationDate: "2026-07-28",
    deathDate: "",
    deathKnowledgeDate: "",
    deathRelatedToWork: false,
    catNumber: "",
    deathPaymentRecipient: "DECEASED_CPF",
    contractType: "Prazo indeterminado",
    reciprocalEarlyTerminationClause: false,
    union: "Sindicato teste",
    collectiveAgreement: "CCT teste",
    terminationType: "DISMISSAL_WITHOUT_CAUSE",
    noticeType: "INDEMNIFIED_EMPLOYER",
    noticeDays: 36,
    expectedContractEnd: "",
    baseSalary: 3500,
    variableAverage: 250,
    usePayrollAverage: true,
    useCompetencePayrollBase: false,
    historySourceCount: 6,
    dependents: 1,
    unpaidAbsenceDays: 0,
    thirteenthMonthsOverride: null,
    thirteenthNoticeMonthsOverride: null,
    vacationMonthsOverride: null,
    accruedVacationPeriods: 0,
    fgtsBalance: 8500,
    otherTaxableEarnings: 0,
    otherNonTaxableEarnings: 0,
    additionalFgtsBase: 0,
    salaryAdvance: 0,
    consignments: 0,
    otherDeductions: 0,
    fixedTermEmployeeDamage: 0,
    priorMonthlyTaxableBase: 0,
    priorMonthlyInss: 0,
    priorMonthlyIrrf: 0,
    priorThirteenthTaxableBase: 0,
    priorThirteenthInss: 0,
    priorThirteenthIrrf: 0,
    fgtsCategory: "STANDARD",
    employerInssPercent: 20,
    ratPercent: 2,
    fapFactor: 1,
    thirdPartiesPercent: 5.8,
    employerParameterSource: "COMPANY_PROFILE",
    notes: "",
    ...overrides,
  });
}

test("projects indemnified notice into proportional rights", () => {
  const result = calculateTermination(input());
  assert.equal(result.projectedTerminationDate, "2026-09-02");
  assert.equal(result.noticeAmount, 4500);
  assert.equal(result.thirteenthBaseMonths, 7);
  assert.equal(result.thirteenthNoticeMonths, 1);
  assert.equal(result.thirteenthMonths, 8);
  assert.equal(result.fgtsFinePercent, 0.4);
  assert.equal(result.rulesVersion, terminationRules2026.version);
});

test("applies half indemnified notice and 20% FGTS fine to mutual agreement", () => {
  const result = calculateTermination(
    input({ terminationType: "MUTUAL_AGREEMENT" }),
  );
  assert.equal(result.noticeAmount, 2250);
  assert.equal(result.noticeProjectionDays, 18);
  assert.equal(result.projectedTerminationDate, "2026-08-15");
  assert.equal(result.fgtsFinePercent, 0.2);
  assert.equal(result.fgtsFine, 1832);
});

test("separates employee notice deduction from statutory taxes", () => {
  const result = calculateTermination(
    input({
      terminationType: "RESIGNATION",
      noticeType: "INDEMNIFIED_EMPLOYEE",
    }),
  );
  assert.equal(result.noticeAmount, 0);
  assert.equal(result.noticeDeduction, 3750);
  assert.equal(result.fgtsFine, 0);
  assert.equal(result.totalDeductions > result.noticeDeduction, true);
});

test("removes proportional 13th and vacation from the administrative just-cause rule", () => {
  const result = calculateTermination(
    input({
      terminationType: "DISMISSAL_FOR_CAUSE",
      noticeType: "NOT_APPLICABLE",
      noticeDays: 0,
    }),
  );
  assert.equal(result.thirteenthSalary, 0);
  assert.equal(result.proportionalVacation, 0);
  assert.equal(result.noticeAmount, 0);
  assert.equal(result.fgtsFine, 0);
});

test("calculates fixed-term employer indemnity from remaining days", () => {
  const result = calculateTermination(
    input({
      terminationType: "EARLY_EMPLOYER_FIXED_TERM",
      noticeType: "NOT_APPLICABLE",
      noticeDays: 0,
      expectedContractEnd: "2026-10-31",
    }),
  );
  assert.equal(result.remainingFixedTermDays, 95);
  assert.equal(result.fixedTermIndemnity, 5937.5);
});

test("calculates employee death as a preview with eSocial reason 10", () => {
  const deathInput = input({
    terminationType: "EMPLOYEE_DEATH",
    noticeType: "NOT_APPLICABLE",
    noticeDays: 0,
    deathDate: "2026-07-28",
    deathKnowledgeDate: "2026-07-30",
    deathRelatedToWork: true,
    catNumber: "CAT-TST-001",
    deathPaymentRecipient: "SUCCESSORS",
  });
  const result = calculateTermination(deathInput);
  assert.deepEqual(validateTerminationInput(deathInput), []);
  assert.equal(result.esocialReasonCode, "10");
  assert.equal(result.esocialDeadlineBaseDate, "2026-08-09");
  assert.equal(result.paymentDeadlineBaseDate, "2026-08-07");
  assert.equal(result.esocialIndApurIR, "1");
  assert.equal(result.esocialPaymentEvent, "EFD-REINF");
  assert.equal(result.noticeAmount, 0);
  assert.equal(result.fgtsFine, 0);
  assert.equal(result.thirteenthSalary > 0, true);
  assert.equal(result.proportionalVacation > 0, true);
});

test("maps the core termination rubrics to the current eSocial incidence table", () => {
  const result = calculateTermination(input());
  const byNature = new Map(
    result.lines.map((item) => [item.esocialNatureCode, item]),
  );

  assert.deepEqual(
    {
      cp: byNature.get("6003")?.codIncCP,
      irrf: byNature.get("6003")?.codIncIRRF,
      fgts: byNature.get("6003")?.codIncFGTS,
    },
    { cp: "00", irrf: "74", fgts: "21" },
  );
  assert.deepEqual(
    {
      cp: byNature.get("6002")?.codIncCP,
      irrf: byNature.get("6002")?.codIncIRRF,
      fgts: byNature.get("6002")?.codIncFGTS,
    },
    { cp: "12", irrf: "12", fgts: "12" },
  );
  assert.deepEqual(
    {
      cp: byNature.get("6001")?.codIncCP,
      irrf: byNature.get("6001")?.codIncIRRF,
      fgts: byNature.get("6001")?.codIncFGTS,
    },
    { cp: "12", irrf: "12", fgts: "21" },
  );
});

test("keeps the 13th projection when indemnified notice crosses the year", () => {
  const result = calculateTermination(
    input({
      admissionDate: "2024-01-01",
      terminationDate: "2026-12-20",
      noticeDays: 30,
    }),
  );

  assert.equal(result.projectedTerminationDate, "2027-01-19");
  assert.equal(result.thirteenthBaseMonths, 12);
  assert.equal(result.thirteenthNoticeMonths, 1);
  assert.equal(result.thirteenthMonths, 13);
});

test("uses ordinary dismissal rules when a fixed-term contract has a reciprocal clause", () => {
  const employerResult = calculateTermination(
    input({
      terminationType: "EARLY_EMPLOYER_FIXED_TERM",
      noticeType: "INDEMNIFIED_EMPLOYER",
      noticeDays: 30,
      expectedContractEnd: "2026-10-31",
      reciprocalEarlyTerminationClause: true,
    }),
  );
  assert.equal(employerResult.esocialReasonCode, "02");
  assert.equal(employerResult.fixedTermIndemnity, 0);
  assert.equal(employerResult.fgtsFinePercent, 0.4);

  const employeeResult = calculateTermination(
    input({
      terminationType: "EARLY_EMPLOYEE_FIXED_TERM",
      noticeType: "INDEMNIFIED_EMPLOYEE",
      noticeDays: 30,
      expectedContractEnd: "2026-10-31",
      reciprocalEarlyTerminationClause: true,
      fixedTermEmployeeDamage: 900,
    }),
  );
  assert.equal(employeeResult.esocialReasonCode, "07");
  assert.equal(employeeResult.noticeDeduction, 3750);
  assert.equal(
    employeeResult.lines.some((item) => item.code === "6904"),
    false,
  );
});

test("uses cumulative monthly bases and subtracts amounts already retained", () => {
  const withoutPrior = calculateTermination(input());
  const withPrior = calculateTermination(
    input({
      useCompetencePayrollBase: true,
      priorMonthlyTaxableBase: 1000,
      priorMonthlyInss: 75,
      priorMonthlyIrrf: 0,
    }),
  );
  assert.equal(withPrior.inssSalary < withoutPrior.inssSalary + 75, true);
  assert.equal(withPrior.inssSalary >= 0, true);
});

test("rejects a termination before admission", () => {
  const invalid = input({
    admissionDate: "2026-08-01",
    terminationDate: "2026-07-28",
  });
  assert.match(
    validateTerminationInput(invalid).join(" "),
    /antes da admissão/i,
  );
});

test("runs the two validation scenarios displayed on the site", () => {
  const suite = runTerminationValidationSuite();

  assert.equal(suite.totalCases, 2);
  assert.equal(suite.passedCases, 2);
  assert.equal(suite.allPassed, true);
  assert.equal(
    suite.cases.every(
      (testCase) =>
        testCase.passed &&
        testCase.checks.every((check) => check.passed),
    ),
    true,
  );
});
