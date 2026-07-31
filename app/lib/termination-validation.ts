import {
  calculateTermination,
  normalizeTerminationInput,
  terminationRules2026,
  type TerminationInput,
} from "./termination.ts";

export type TerminationValidationCheck = {
  id: string;
  label: string;
  expected: string;
  actual: string;
  passed: boolean;
};

export type TerminationValidationCase = {
  id: string;
  title: string;
  purpose: string;
  inputs: Array<{ label: string; value: string }>;
  checks: TerminationValidationCheck[];
  passed: boolean;
};

export type TerminationValidationSuite = {
  rulesVersion: string;
  totalCases: number;
  passedCases: number;
  allPassed: boolean;
  cases: TerminationValidationCase[];
};

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const money = (value: number) =>
  Math.round(((Number.isFinite(value) ? value : 0) + 1e-9) * 100) / 100;

function baseInput(
  overrides: Partial<TerminationInput> = {},
): TerminationInput {
  return normalizeTerminationInput({
    employeeRecordId: 99_001,
    employeeName: "Funcionário fictício de validação",
    employeeCode: "TST-RES-SITE",
    role: "Profissional de obra",
    admissionDate: "2024-02-10",
    terminationDate: "2026-07-28",
    deathDate: "",
    deathKnowledgeDate: "",
    deathRelatedToWork: false,
    catNumber: "",
    deathPaymentRecipient: "DECEASED_CPF",
    contractType: "Prazo indeterminado",
    reciprocalEarlyTerminationClause: false,
    union: "Sindicato fictício",
    collectiveAgreement: "CCT fictícia para validação",
    terminationType: "DISMISSAL_WITHOUT_CAUSE",
    noticeType: "INDEMNIFIED_EMPLOYER",
    noticeDays: 36,
    expectedContractEnd: "",
    baseSalary: 3500,
    variableAverage: 250,
    usePayrollAverage: false,
    useCompetencePayrollBase: false,
    historySourceCount: 0,
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
    notes: "Cenário fictício executado pelo laboratório de validação.",
    ...overrides,
  });
}

function textCheck(
  id: string,
  label: string,
  expected: string,
  actual: string,
): TerminationValidationCheck {
  return {
    id,
    label,
    expected,
    actual,
    passed: actual === expected,
  };
}

function moneyCheck(
  id: string,
  label: string,
  expected: number,
  actual: number,
): TerminationValidationCheck {
  return {
    id,
    label,
    expected: currency.format(expected),
    actual: currency.format(actual),
    passed: money(actual) === money(expected),
  };
}

function percentageCheck(
  id: string,
  label: string,
  expected: number,
  actual: number,
): TerminationValidationCheck {
  const formattedExpected = `${money(expected * 100)}%`;
  const formattedActual = `${money(actual * 100)}%`;
  return {
    id,
    label,
    expected: formattedExpected,
    actual: formattedActual,
    passed: money(actual) === money(expected),
  };
}

function buildDismissalCase(): TerminationValidationCase {
  const result = calculateTermination(baseInput());
  const mappedNatureCodes = new Set(
    result.lines.map((line) => line.esocialNatureCode),
  );
  const checks = [
    textCheck(
      "dismissal-projection",
      "Projeção do aviso",
      "02/09/2026",
      new Date(
        `${result.projectedTerminationDate}T12:00:00`,
      ).toLocaleDateString("pt-BR"),
    ),
    moneyCheck(
      "dismissal-notice",
      "Aviso prévio indenizado",
      4500,
      result.noticeAmount,
    ),
    textCheck(
      "dismissal-thirteenth",
      "13º proporcional",
      "7/12 trabalhado + 1/12 aviso",
      `${result.thirteenthBaseMonths}/12 trabalhado + ${result.thirteenthNoticeMonths}/12 aviso`,
    ),
    percentageCheck(
      "dismissal-fgts-rate",
      "Indenização do FGTS",
      0.4,
      result.fgtsFinePercent,
    ),
    moneyCheck(
      "dismissal-fgts-value",
      "Valor da indenização do FGTS",
      3736,
      result.fgtsFine,
    ),
    textCheck(
      "dismissal-rubrics",
      "Naturezas essenciais",
      "6001, 6002 e 6003 presentes",
      ["6001", "6002", "6003"].every((code) =>
        mappedNatureCodes.has(code),
      )
        ? "6001, 6002 e 6003 presentes"
        : "Natureza ausente",
    ),
  ];

  return {
    id: "dismissal-without-cause",
    title: "Teste 1 • Dispensa sem justa causa",
    purpose:
      "Confere aviso proporcional, projeção, 13º separado e indenização de 40% do FGTS.",
    inputs: [
      { label: "Admissão", value: "10/02/2024" },
      { label: "Desligamento", value: "28/07/2026" },
      { label: "Salário", value: "R$ 3.500,00" },
      { label: "Média variável", value: "R$ 250,00" },
      { label: "Saldo FGTS", value: "R$ 8.500,00" },
      { label: "Aviso", value: "36 dias indenizados" },
    ],
    checks,
    passed: checks.every((check) => check.passed),
  };
}

function buildDeathCase(): TerminationValidationCase {
  const result = calculateTermination(
    baseInput({
      admissionDate: "2026-05-05",
      terminationDate: "2026-07-28",
      deathDate: "2026-07-28",
      deathKnowledgeDate: "2026-07-30",
      deathPaymentRecipient: "SUCCESSORS",
      terminationType: "EMPLOYEE_DEATH",
      noticeType: "NOT_APPLICABLE",
      noticeDays: 0,
      baseSalary: 3500,
      variableAverage: 0,
      dependents: 0,
      fgtsBalance: 0,
    }),
  );
  const checks = [
    textCheck(
      "death-reason",
      "Motivo do S-2299",
      "10",
      result.esocialReasonCode,
    ),
    moneyCheck(
      "death-gross",
      "Total bruto da prévia",
      5308.34,
      result.gross,
    ),
    moneyCheck(
      "death-net",
      "Líquido estimado",
      4962.11,
      result.net,
    ),
    moneyCheck(
      "death-notice",
      "Aviso prévio",
      0,
      result.noticeAmount,
    ),
    moneyCheck(
      "death-fgts-fine",
      "Indenização do FGTS",
      0,
      result.fgtsFine,
    ),
    textCheck(
      "death-deadline",
      "Prazo-base do S-2299",
      "09/08/2026",
      new Date(
        `${result.esocialDeadlineBaseDate}T12:00:00`,
      ).toLocaleDateString("pt-BR"),
    ),
    textCheck(
      "death-ir-indicator",
      "Indicador de apuração do IR",
      "indApurIR = 1",
      `indApurIR = ${result.esocialIndApurIR}`,
    ),
    textCheck(
      "death-payment-event",
      "Destino declaratório futuro",
      "EFD-REINF",
      result.esocialPaymentEvent,
    ),
  ];

  return {
    id: "employee-death-successors",
    title: "Teste 2 • Falecimento com sucessores",
    purpose:
      "Confere motivo 10, cálculo sem aviso ou multa, prazo pela ciência da empresa e rota declaratória.",
    inputs: [
      { label: "Admissão", value: "05/05/2026" },
      { label: "Óbito", value: "28/07/2026" },
      { label: "Ciência da empresa", value: "30/07/2026" },
      { label: "Salário", value: "R$ 3.500,00" },
      { label: "Pagamento", value: "Sucessores habilitados" },
      { label: "Aviso", value: "Não aplicável" },
    ],
    checks,
    passed: checks.every((check) => check.passed),
  };
}

export function runTerminationValidationSuite(): TerminationValidationSuite {
  const cases = [buildDismissalCase(), buildDeathCase()];
  const passedCases = cases.filter((testCase) => testCase.passed).length;

  return {
    rulesVersion: terminationRules2026.version,
    totalCases: cases.length,
    passedCases,
    allPassed: passedCases === cases.length,
    cases,
  };
}
