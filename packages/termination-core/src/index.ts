import {
  calculatePayroll,
  calculateProgressiveInss,
  payrollRules2026,
} from "../../payroll-core/src/index.ts";

export type TerminationType =
  | "DISMISSAL_WITHOUT_CAUSE"
  | "RESIGNATION"
  | "MUTUAL_AGREEMENT"
  | "FIXED_TERM_END"
  | "EARLY_EMPLOYER_FIXED_TERM"
  | "EARLY_EMPLOYEE_FIXED_TERM"
  | "DISMISSAL_FOR_CAUSE"
  | "INDIRECT_TERMINATION"
  | "EMPLOYEE_DEATH";

export type TerminationNoticeType =
  | "WORKED"
  | "INDEMNIFIED_EMPLOYER"
  | "INDEMNIFIED_EMPLOYEE"
  | "WAIVED"
  | "NOT_APPLICABLE";

export type DeathPaymentRecipient =
  | "DECEASED_CPF"
  | "SUCCESSORS";

export type TerminationInput = {
  employeeRecordId: number;
  employeeName: string;
  employeeCode: string;
  role: string;
  admissionDate: string;
  terminationDate: string;
  deathDate: string;
  deathKnowledgeDate: string;
  deathRelatedToWork: boolean;
  catNumber: string;
  deathPaymentRecipient: DeathPaymentRecipient;
  contractType: string;
  reciprocalEarlyTerminationClause: boolean;
  union: string;
  collectiveAgreement: string;
  terminationType: TerminationType;
  noticeType: TerminationNoticeType;
  noticeDays: number;
  expectedContractEnd: string;
  baseSalary: number;
  variableAverage: number;
  usePayrollAverage: boolean;
  useCompetencePayrollBase: boolean;
  historySourceCount: number;
  dependents: number;
  unpaidAbsenceDays: number;
  thirteenthMonthsOverride: number | null;
  thirteenthNoticeMonthsOverride: number | null;
  vacationMonthsOverride: number | null;
  accruedVacationPeriods: number;
  fgtsBalance: number;
  otherTaxableEarnings: number;
  otherNonTaxableEarnings: number;
  additionalFgtsBase: number;
  salaryAdvance: number;
  consignments: number;
  otherDeductions: number;
  fixedTermEmployeeDamage: number;
  priorMonthlyTaxableBase: number;
  priorMonthlyInss: number;
  priorMonthlyIrrf: number;
  priorThirteenthTaxableBase: number;
  priorThirteenthInss: number;
  priorThirteenthIrrf: number;
  fgtsCategory: "STANDARD" | "APPRENTICE";
  employerInssPercent: number;
  ratPercent: number;
  fapFactor: number;
  thirdPartiesPercent: number;
  employerParameterSource: "COMPANY_PROFILE" | "ESTIMATE";
  notes: string;
};

export type TerminationLine = {
  code: string;
  label: string;
  reference: string;
  base: number;
  rate?: number;
  amount: number;
  kind: "earning" | "deduction" | "employer";
  incidence: string;
  esocialNatureCode: string;
  codIncCP: string;
  codIncIRRF: string;
  codIncFGTS: string;
  esocialOrigin: "S-2299" | "S-5001" | "S-5003" | "REVIEW";
  mappingStatus: "MAPPED" | "REVIEW" | "TOTALIZER";
  note: string;
};

export type TerminationResult = {
  remunerationBase: number;
  projectedTerminationDate: string;
  serviceYears: number;
  noticeDays: number;
  noticeProjectionDays: number;
  salaryBalanceDays: number;
  thirteenthMonths: number;
  thirteenthBaseMonths: number;
  thirteenthNoticeMonths: number;
  vacationMonths: number;
  remainingFixedTermDays: number;
  salaryBalance: number;
  noticeAmount: number;
  noticeDeduction: number;
  thirteenthBaseSalary: number;
  thirteenthNoticeSalary: number;
  thirteenthSalary: number;
  accruedVacation: number;
  proportionalVacation: number;
  vacationThird: number;
  fixedTermIndemnity: number;
  otherEarnings: number;
  gross: number;
  inssSalary: number;
  inssThirteenth: number;
  irrfSalary: number;
  irrfThirteenth: number;
  fgtsMonthlyBase: number;
  fgtsThirteenthBase: number;
  fgtsNoticeBase: number;
  fgtsSeveranceBase: number;
  fgtsMonthlyDeposit: number;
  fgtsThirteenthDeposit: number;
  fgtsNoticeDeposit: number;
  fgtsSeveranceDeposit: number;
  fgtsFinePercent: number;
  fgtsFine: number;
  employerSocialCharges: number;
  totalDeductions: number;
  net: number;
  employerCost: number;
  esocialReasonCode: string;
  esocialDeadlineBaseDate: string;
  paymentDeadlineBaseDate: string;
  esocialIndApurIR: "0" | "1";
  esocialPaymentEvent: "S-1210" | "EFD-REINF";
  lines: TerminationLine[];
  rulesVersion: string;
  mosVersion: string;
  layoutVersion: string;
  warnings: string[];
};

export const terminationRules2026 = {
  version: "BR-RESCISAO-2026.2",
  effectiveFrom: "2026-01-01",
  mosVersion:
    "MOS eSocial S-1.3 consolidado até a NO 11/2026 — retificado em 28/05/2026",
  layoutVersion:
    "Leiautes eSocial S-1.3 — NT 06/2026, revisão de 09/04/2026",
  esocialEvent: "S-2299",
  standardFgtsRate: payrollRules2026.standardFgtsRate,
  apprenticeFgtsRate: payrollRules2026.apprenticeFgtsRate,
  noticeBaseDays: 30,
  noticeAdditionalDaysPerYear: 3,
  noticeMaximumDays: 90,
  mutualAgreementNoticeFactor: 0.5,
  mutualAgreementFgtsFine: 0.2,
  dismissalFgtsFine: 0.4,
  fixedTermEmployerIndemnityFactor: 0.5,
  sources: [
    {
      label: "MOS eSocial S-1.3 — consolidado até NO 11/2026",
      url: "https://www.gov.br/esocial/pt-br/documentacao-tecnica/manuais/mos-s-1-3-consolidada-ate-a-no-s-1-3-11-2026-retificada.pdf",
    },
    {
      label: "Leiautes e regras eSocial S-1.3 — NT 06/2026",
      url: "https://www.gov.br/esocial/pt-br/documentacao-tecnica/leiautes-esocial-versao-s-1-3-nt-06-2026-rev-09-04-2026/index.html",
    },
    {
      label: "Tabelas eSocial S-1.3 — naturezas, motivos e incidências",
      url: "https://www.gov.br/esocial/pt-br/documentacao-tecnica/leiautes-esocial-versao-s-1-3-nt-06-2026/tabelas.html",
    },
    {
      label: "Tabela de contribuição mensal do INSS",
      url: "https://www.gov.br/inss/pt-br/direitos-e-deveres/inscricao-e-contribuicao/tabela-de-contribuicao-mensal",
    },
    {
      label: "Tabelas do IRPF 2026 — Receita Federal",
      url: "https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/tabelas/2026",
    },
    {
      label: "FGTS Digital — orientações ao empregador",
      url: "https://www.gov.br/trabalho-e-emprego/pt-br/servicos/empregador/fgtsdigital",
    },
    {
      label: "Conectividade Social ICP V2",
      url: "https://conectividadesocialv2.caixa.gov.br/",
    },
  ],
} as const;

export const terminationTypeLabels: Record<TerminationType, string> = {
  DISMISSAL_WITHOUT_CAUSE: "Dispensa sem justa causa",
  RESIGNATION: "Pedido de demissão",
  MUTUAL_AGREEMENT: "Rescisão por acordo",
  FIXED_TERM_END: "Término normal de contrato a prazo",
  EARLY_EMPLOYER_FIXED_TERM:
    "Término antecipado de contrato a prazo pelo empregador",
  EARLY_EMPLOYEE_FIXED_TERM:
    "Término antecipado de contrato a prazo pelo empregado",
  DISMISSAL_FOR_CAUSE: "Dispensa por justa causa",
  INDIRECT_TERMINATION: "Rescisão indireta",
  EMPLOYEE_DEATH: "Falecimento do empregado",
};

export const terminationNoticeLabels: Record<
  TerminationNoticeType,
  string
> = {
  WORKED: "Aviso prévio trabalhado",
  INDEMNIFIED_EMPLOYER: "Aviso indenizado pelo empregador",
  INDEMNIFIED_EMPLOYEE: "Aviso não cumprido pelo empregado",
  WAIVED: "Aviso dispensado / sem desconto",
  NOT_APPLICABLE: "Não se aplica",
};

const esocialReasonCodes: Record<TerminationType, string> = {
  DISMISSAL_WITHOUT_CAUSE: "02",
  RESIGNATION: "07",
  MUTUAL_AGREEMENT: "33",
  FIXED_TERM_END: "06",
  EARLY_EMPLOYER_FIXED_TERM: "03",
  EARLY_EMPLOYEE_FIXED_TERM: "04",
  DISMISSAL_FOR_CAUSE: "01",
  INDIRECT_TERMINATION: "17",
  EMPLOYEE_DEATH: "10",
};

const money = (value: number) =>
  Math.round(((Number.isFinite(value) ? value : 0) + 1e-9) * 100) / 100;

const numeric = (value: unknown, fallback = 0) => {
  const normalized =
    typeof value === "string" ? value.replace(",", ".") : value;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const nonNegative = (value: unknown, fallback = 0) =>
  Math.max(0, numeric(value, fallback));

const bounded = (
  value: unknown,
  minimum: number,
  maximum: number,
  fallback: number,
) => Math.min(maximum, Math.max(minimum, numeric(value, fallback)));

const roundInteger = (
  value: unknown,
  minimum: number,
  maximum: number,
  fallback: number,
) => Math.round(bounded(value, minimum, maximum, fallback));

function validIsoDate(value: unknown) {
  const text = String(value ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return "";
  const date = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text
    ? text
    : "";
}

function dateFromIso(value: string) {
  return new Date(`${value}T00:00:00Z`);
}

function isoFromDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function addDays(value: Date, days: number) {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function addMonthsClamped(value: Date, months: number) {
  const day = value.getUTCDate();
  const next = new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + months, 1),
  );
  const finalDay = new Date(
    Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0),
  ).getUTCDate();
  next.setUTCDate(Math.min(day, finalDay));
  return next;
}

function inclusiveDays(start: Date, end: Date) {
  if (end < start) return 0;
  return (
    Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1
  );
}

function completedYears(start: Date, end: Date) {
  let years = end.getUTCFullYear() - start.getUTCFullYear();
  const anniversary = new Date(
    Date.UTC(
      end.getUTCFullYear(),
      start.getUTCMonth(),
      Math.min(
        start.getUTCDate(),
        new Date(
          Date.UTC(end.getUTCFullYear(), start.getUTCMonth() + 1, 0),
        ).getUTCDate(),
      ),
    ),
  );
  if (end < anniversary) years -= 1;
  return Math.max(0, years);
}

function currentVacationPeriodStart(admission: Date, end: Date) {
  let start = new Date(
    Date.UTC(
      end.getUTCFullYear(),
      admission.getUTCMonth(),
      Math.min(
        admission.getUTCDate(),
        new Date(
          Date.UTC(end.getUTCFullYear(), admission.getUTCMonth() + 1, 0),
        ).getUTCDate(),
      ),
    ),
  );
  if (start > end) {
    start = new Date(
      Date.UTC(
        end.getUTCFullYear() - 1,
        admission.getUTCMonth(),
        Math.min(
          admission.getUTCDate(),
          new Date(
            Date.UTC(end.getUTCFullYear() - 1, admission.getUTCMonth() + 1, 0),
          ).getUTCDate(),
        ),
      ),
    );
  }
  return start;
}

function calendarYearTwelfths(
  admission: Date,
  end: Date,
  year = end.getUTCFullYear(),
) {
  let count = 0;
  for (let month = 0; month < 12; month += 1) {
    const monthStart = new Date(Date.UTC(year, month, 1));
    const monthEnd = new Date(Date.UTC(year, month + 1, 0));
    const serviceStart = admission > monthStart ? admission : monthStart;
    const serviceEnd = end < monthEnd ? end : monthEnd;
    if (inclusiveDays(serviceStart, serviceEnd) >= 15) count += 1;
  }
  return count;
}

function thirteenthProjectionTwelfths(
  admission: Date,
  termination: Date,
  projectedTermination: Date,
) {
  const years = Array.from(
    new Set([
      termination.getUTCFullYear(),
      projectedTermination.getUTCFullYear(),
    ]),
  );
  const actual = years.reduce(
    (total, year) =>
      total + calendarYearTwelfths(admission, termination, year),
    0,
  );
  const projected = years.reduce(
    (total, year) =>
      total + calendarYearTwelfths(admission, projectedTermination, year),
    0,
  );
  return Math.max(0, projected - actual);
}

function vacationTwelfths(admission: Date, end: Date) {
  const periodStart = currentVacationPeriodStart(admission, end);
  let count = 0;
  for (let month = 0; month < 12; month += 1) {
    const start = addMonthsClamped(periodStart, month);
    const next = addMonthsClamped(periodStart, month + 1);
    const finish = addDays(next, -1);
    const serviceEnd = end < finish ? end : finish;
    if (inclusiveDays(start, serviceEnd) >= 15) count += 1;
    if (serviceEnd >= end) break;
  }
  return Math.min(12, count);
}

function defaultNoticeDays(admission: Date, termination: Date) {
  return Math.min(
    terminationRules2026.noticeMaximumDays,
    terminationRules2026.noticeBaseDays +
      completedYears(admission, termination) *
        terminationRules2026.noticeAdditionalDaysPerYear,
  );
}

function estimateIrrf(base: number, dependents: number) {
  if (base <= 0) return 0;
  return calculatePayroll({
    employeeName: "Base rescisória",
    employeeCode: "",
    role: "",
    workName: "",
    competence: "2026-01-01",
    baseSalary: base,
    monthlyHours: 220,
    overtimeHours: 0,
    overtimePercent: 50,
    additionalType: "NONE",
    insalubrityDegree: 20,
    insalubrityBase: payrollRules2026.minimumWage,
    taxableAdditions: 0,
    nonTaxableEarnings: 0,
    dependents,
    pensionDeduction: 0,
    salaryAdvance: 0,
    consignments: 0,
    unionContribution: 0,
    otherDeductions: 0,
    fgtsCategory: "STANDARD",
    employerInssPercent: 0,
    ratPercent: 0,
    fapFactor: 1,
    thirdPartiesPercent: 0,
    employerParameterSource: "ESTIMATE",
  }).irrf;
}

function terminationType(value: unknown): TerminationType {
  const candidate = String(value) as TerminationType;
  return Object.prototype.hasOwnProperty.call(terminationTypeLabels, candidate)
    ? candidate
    : "DISMISSAL_WITHOUT_CAUSE";
}

function noticeType(value: unknown): TerminationNoticeType {
  const candidate = String(value) as TerminationNoticeType;
  return Object.prototype.hasOwnProperty.call(terminationNoticeLabels, candidate)
    ? candidate
    : "INDEMNIFIED_EMPLOYER";
}

function optionalMonths(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  return roundInteger(value, 0, 12, 0);
}

function deathPaymentRecipient(value: unknown): DeathPaymentRecipient {
  return value === "SUCCESSORS" ? "SUCCESSORS" : "DECEASED_CPF";
}

function esocialReasonCode(input: TerminationInput) {
  if (
    input.reciprocalEarlyTerminationClause &&
    input.terminationType === "EARLY_EMPLOYER_FIXED_TERM"
  ) {
    return "02";
  }
  if (
    input.reciprocalEarlyTerminationClause &&
    input.terminationType === "EARLY_EMPLOYEE_FIXED_TERM"
  ) {
    return "07";
  }
  return esocialReasonCodes[input.terminationType];
}

export function normalizeTerminationInput(
  raw: Partial<TerminationInput>,
): TerminationInput {
  return {
    employeeRecordId: roundInteger(raw.employeeRecordId, 0, 2_147_483_647, 0),
    employeeName: String(raw.employeeName ?? "").trim().slice(0, 200),
    employeeCode: String(raw.employeeCode ?? "").trim().slice(0, 80),
    role: String(raw.role ?? "").trim().slice(0, 160),
    admissionDate: validIsoDate(raw.admissionDate),
    terminationDate: validIsoDate(raw.terminationDate),
    deathDate: validIsoDate(raw.deathDate),
    deathKnowledgeDate: validIsoDate(raw.deathKnowledgeDate),
    deathRelatedToWork: raw.deathRelatedToWork === true,
    catNumber: String(raw.catNumber ?? "").trim().slice(0, 80),
    deathPaymentRecipient: deathPaymentRecipient(
      raw.deathPaymentRecipient,
    ),
    contractType: String(raw.contractType ?? "").trim().slice(0, 120),
    reciprocalEarlyTerminationClause:
      raw.reciprocalEarlyTerminationClause === true,
    union: String(raw.union ?? "").trim().slice(0, 200),
    collectiveAgreement: String(raw.collectiveAgreement ?? "")
      .trim()
      .slice(0, 240),
    terminationType: terminationType(raw.terminationType),
    noticeType: noticeType(raw.noticeType),
    noticeDays: roundInteger(raw.noticeDays, 0, 90, 0),
    expectedContractEnd: validIsoDate(raw.expectedContractEnd),
    baseSalary: nonNegative(raw.baseSalary),
    variableAverage: nonNegative(raw.variableAverage),
    usePayrollAverage: raw.usePayrollAverage !== false,
    useCompetencePayrollBase: raw.useCompetencePayrollBase === true,
    historySourceCount: roundInteger(raw.historySourceCount, 0, 120, 0),
    dependents: roundInteger(raw.dependents, 0, 99, 0),
    unpaidAbsenceDays: roundInteger(raw.unpaidAbsenceDays, 0, 30, 0),
    thirteenthMonthsOverride: optionalMonths(raw.thirteenthMonthsOverride),
    thirteenthNoticeMonthsOverride: optionalMonths(
      raw.thirteenthNoticeMonthsOverride,
    ),
    vacationMonthsOverride: optionalMonths(raw.vacationMonthsOverride),
    accruedVacationPeriods: roundInteger(
      raw.accruedVacationPeriods,
      0,
      10,
      0,
    ),
    fgtsBalance: nonNegative(raw.fgtsBalance),
    otherTaxableEarnings: nonNegative(raw.otherTaxableEarnings),
    otherNonTaxableEarnings: nonNegative(raw.otherNonTaxableEarnings),
    additionalFgtsBase: nonNegative(raw.additionalFgtsBase),
    salaryAdvance: nonNegative(raw.salaryAdvance),
    consignments: nonNegative(raw.consignments),
    otherDeductions: nonNegative(raw.otherDeductions),
    fixedTermEmployeeDamage: nonNegative(raw.fixedTermEmployeeDamage),
    priorMonthlyTaxableBase: nonNegative(raw.priorMonthlyTaxableBase),
    priorMonthlyInss: nonNegative(raw.priorMonthlyInss),
    priorMonthlyIrrf: nonNegative(raw.priorMonthlyIrrf),
    priorThirteenthTaxableBase: nonNegative(raw.priorThirteenthTaxableBase),
    priorThirteenthInss: nonNegative(raw.priorThirteenthInss),
    priorThirteenthIrrf: nonNegative(raw.priorThirteenthIrrf),
    fgtsCategory:
      raw.fgtsCategory === "APPRENTICE" ? "APPRENTICE" : "STANDARD",
    employerInssPercent: bounded(raw.employerInssPercent, 0, 50, 20),
    ratPercent: bounded(raw.ratPercent, 0, 10, 2),
    fapFactor: bounded(raw.fapFactor, 0.5, 2, 1),
    thirdPartiesPercent: bounded(raw.thirdPartiesPercent, 0, 20, 5.8),
    employerParameterSource:
      raw.employerParameterSource === "COMPANY_PROFILE"
        ? "COMPANY_PROFILE"
        : "ESTIMATE",
    notes: String(raw.notes ?? "").trim().slice(0, 5_000),
  };
}

export function validateTerminationInput(input: TerminationInput) {
  const errors: string[] = [];
  if (!input.employeeRecordId) {
    errors.push("Selecione um funcionário cadastrado.");
  }
  if (!input.employeeName) errors.push("Informe o nome do funcionário.");
  if (!input.admissionDate) errors.push("Informe uma data de admissão válida.");
  if (!input.terminationDate) {
    errors.push("Informe uma data de desligamento válida.");
  }
  if (
    input.admissionDate &&
    input.terminationDate &&
    input.terminationDate < input.admissionDate
  ) {
    errors.push("O desligamento não pode ocorrer antes da admissão.");
  }
  if (input.baseSalary <= 0) {
    errors.push("O salário-base deve ser maior que zero.");
  }
  if (input.terminationType === "EMPLOYEE_DEATH") {
    if (!input.deathDate) {
      errors.push("Informe a data do óbito.");
    } else if (input.deathDate !== input.terminationDate) {
      errors.push(
        "No falecimento do empregado, a data do óbito deve coincidir com a data do desligamento.",
      );
    }
    if (!input.deathKnowledgeDate) {
      errors.push("Informe a data em que a empresa tomou ciência do óbito.");
    } else if (
      input.deathDate &&
      input.deathKnowledgeDate < input.deathDate
    ) {
      errors.push(
        "A ciência do óbito não pode ser anterior à data do óbito.",
      );
    }
  }
  if (
    ["EARLY_EMPLOYER_FIXED_TERM", "EARLY_EMPLOYEE_FIXED_TERM"].includes(
      input.terminationType,
    ) &&
    (!input.expectedContractEnd ||
      input.expectedContractEnd <= input.terminationDate)
  ) {
    errors.push(
      "Informe o término previsto posterior ao desligamento para validar o contrato a prazo.",
    );
  }
  return errors;
}

function line(
  code: string,
  label: string,
  reference: string,
  base: number,
  amount: number,
  kind: TerminationLine["kind"],
  incidence: string,
  note: string,
  mapping: {
    esocialNatureCode: string;
    codIncCP: string;
    codIncIRRF: string;
    codIncFGTS: string;
    esocialOrigin: TerminationLine["esocialOrigin"];
    mappingStatus?: TerminationLine["mappingStatus"];
  },
  rate?: number,
): TerminationLine {
  return {
    code,
    label,
    reference,
    base: money(base),
    rate,
    amount: money(amount),
    kind,
    incidence,
    esocialNatureCode: mapping.esocialNatureCode,
    codIncCP: mapping.codIncCP,
    codIncIRRF: mapping.codIncIRRF,
    codIncFGTS: mapping.codIncFGTS,
    esocialOrigin: mapping.esocialOrigin,
    mappingStatus: mapping.mappingStatus || "MAPPED",
    note,
  };
}

export function calculateTermination(
  rawInput: TerminationInput,
): TerminationResult {
  const input = normalizeTerminationInput(rawInput);
  const admission = input.admissionDate
    ? dateFromIso(input.admissionDate)
    : new Date(Date.UTC(2026, 0, 1));
  const termination = input.terminationDate
    ? dateFromIso(input.terminationDate)
    : new Date(Date.UTC(2026, 0, 1));
  const serviceYears = completedYears(admission, termination);
  const automaticNoticeDays = defaultNoticeDays(admission, termination);
  const noticeDays = input.noticeDays || automaticNoticeDays;
  const employerNoticeTypes: TerminationType[] = [
    "DISMISSAL_WITHOUT_CAUSE",
    "INDIRECT_TERMINATION",
    "MUTUAL_AGREEMENT",
  ];
  if (
    input.reciprocalEarlyTerminationClause &&
    input.terminationType === "EARLY_EMPLOYER_FIXED_TERM"
  ) {
    employerNoticeTypes.push("EARLY_EMPLOYER_FIXED_TERM");
  }
  const hasEmployerNotice =
    input.noticeType === "INDEMNIFIED_EMPLOYER" &&
    employerNoticeTypes.includes(input.terminationType);
  const noticeMultiplier =
    hasEmployerNotice && input.terminationType === "MUTUAL_AGREEMENT"
      ? terminationRules2026.mutualAgreementNoticeFactor
      : hasEmployerNotice
        ? 1
        : 0;
  const noticeProjectionDays = Math.round(noticeDays * noticeMultiplier);
  const projectedTermination = hasEmployerNotice
    ? addDays(termination, noticeProjectionDays)
    : termination;
  const remunerationBase = money(input.baseSalary + input.variableAverage);
  const salaryBalanceDays = Math.max(
    0,
    Math.min(30, termination.getUTCDate()) - input.unpaidAbsenceDays,
  );
  const salaryBalance = money(
    (remunerationBase / 30) * salaryBalanceDays,
  );

  const noticeAmount = money(
    (remunerationBase / 30) * noticeDays * noticeMultiplier,
  );
  const noticeDeduction =
    input.noticeType === "INDEMNIFIED_EMPLOYEE" &&
    (input.terminationType === "RESIGNATION" ||
      (input.terminationType === "EARLY_EMPLOYEE_FIXED_TERM" &&
        input.reciprocalEarlyTerminationClause))
      ? money(
          Math.min(
            remunerationBase,
            (remunerationBase / 30) * Math.min(30, noticeDays || 30),
          ),
        )
      : 0;

  const receivesProportionalRights =
    input.terminationType !== "DISMISSAL_FOR_CAUSE";
  const calculatedThirteenthBaseMonths = receivesProportionalRights
    ? calendarYearTwelfths(
        admission,
        termination,
        termination.getUTCFullYear(),
      )
    : 0;
  const calculatedThirteenthNoticeMonths =
    receivesProportionalRights && hasEmployerNotice
      ? thirteenthProjectionTwelfths(
          admission,
          termination,
          projectedTermination,
        )
      : 0;
  const thirteenthBaseMonths = receivesProportionalRights
    ? input.thirteenthMonthsOverride ??
      calculatedThirteenthBaseMonths
    : 0;
  const thirteenthNoticeMonths =
    receivesProportionalRights && hasEmployerNotice
      ? input.thirteenthNoticeMonthsOverride ??
        calculatedThirteenthNoticeMonths
      : 0;
  const thirteenthMonths =
    thirteenthBaseMonths + thirteenthNoticeMonths;
  const thirteenthBaseSalary = money(
    (remunerationBase / 12) * thirteenthBaseMonths,
  );
  const thirteenthNoticeSalary = money(
    (remunerationBase / 12) * thirteenthNoticeMonths,
  );
  const thirteenthSalary = money(
    thirteenthBaseSalary + thirteenthNoticeSalary,
  );
  const calculatedVacationMonths = receivesProportionalRights
    ? vacationTwelfths(admission, projectedTermination)
    : 0;
  const vacationMonths = receivesProportionalRights
    ? input.vacationMonthsOverride ?? calculatedVacationMonths
    : 0;
  const accruedVacation = money(
    remunerationBase * input.accruedVacationPeriods,
  );
  const proportionalVacation = money(
    (remunerationBase / 12) * vacationMonths,
  );
  const vacationThird = money(
    (accruedVacation + proportionalVacation) / 3,
  );

  let remainingFixedTermDays = 0;
  let fixedTermIndemnity = 0;
  if (
    input.terminationType === "EARLY_EMPLOYER_FIXED_TERM" &&
    !input.reciprocalEarlyTerminationClause &&
    input.expectedContractEnd
  ) {
    const expectedEnd = dateFromIso(input.expectedContractEnd);
    remainingFixedTermDays = Math.max(
      0,
      inclusiveDays(addDays(termination, 1), expectedEnd),
    );
    fixedTermIndemnity = money(
      (remunerationBase / 30) *
        remainingFixedTermDays *
        terminationRules2026.fixedTermEmployerIndemnityFactor,
    );
  }

  const otherEarnings = money(
    input.otherTaxableEarnings + input.otherNonTaxableEarnings,
  );
  const gross = money(
    salaryBalance +
      noticeAmount +
      thirteenthSalary +
      accruedVacation +
      proportionalVacation +
      vacationThird +
      fixedTermIndemnity +
      otherEarnings,
  );

  const monthlyTaxableCurrent =
    salaryBalance + input.otherTaxableEarnings;
  const monthlyTaxableCumulative =
    input.priorMonthlyTaxableBase + monthlyTaxableCurrent;
  const inssSalary = money(
    Math.max(
      0,
      calculateProgressiveInss(monthlyTaxableCumulative) -
        input.priorMonthlyInss,
    ),
  );
  const thirteenthTaxableCumulative =
    input.priorThirteenthTaxableBase + thirteenthSalary;
  const inssThirteenth = money(
    Math.max(
      0,
      calculateProgressiveInss(thirteenthTaxableCumulative) -
        input.priorThirteenthInss,
    ),
  );
  const irrfSalary = money(
    Math.max(
      0,
      estimateIrrf(monthlyTaxableCumulative, input.dependents) -
        input.priorMonthlyIrrf,
    ),
  );
  const irrfThirteenth = money(
    Math.max(
      0,
      estimateIrrf(thirteenthTaxableCumulative, input.dependents) -
        input.priorThirteenthIrrf,
    ),
  );

  const fgtsRate =
    input.fgtsCategory === "APPRENTICE"
      ? terminationRules2026.apprenticeFgtsRate
      : terminationRules2026.standardFgtsRate;
  const fgtsMonthlyBase = money(
    salaryBalance +
      input.otherTaxableEarnings +
      input.additionalFgtsBase,
  );
  const fgtsThirteenthBase = money(thirteenthBaseSalary);
  const fgtsNoticeBase = money(
    noticeAmount + thirteenthNoticeSalary,
  );
  const fgtsSeveranceBase = money(
    fgtsMonthlyBase + fgtsThirteenthBase + fgtsNoticeBase,
  );
  const fgtsMonthlyDeposit = money(fgtsMonthlyBase * fgtsRate);
  const fgtsThirteenthDeposit = money(
    fgtsThirteenthBase * fgtsRate,
  );
  const fgtsNoticeDeposit = money(fgtsNoticeBase * fgtsRate);
  const fgtsSeveranceDeposit = money(
    fgtsMonthlyDeposit +
      fgtsThirteenthDeposit +
      fgtsNoticeDeposit,
  );
  const fgtsFinePercent =
    ["DISMISSAL_WITHOUT_CAUSE", "INDIRECT_TERMINATION"].includes(
      input.terminationType,
    ) ||
    (input.terminationType === "EARLY_EMPLOYER_FIXED_TERM" &&
      input.reciprocalEarlyTerminationClause)
      ? terminationRules2026.dismissalFgtsFine
      : input.terminationType === "MUTUAL_AGREEMENT"
        ? terminationRules2026.mutualAgreementFgtsFine
        : 0;
  const fgtsFine = money(
    (input.fgtsBalance + fgtsSeveranceDeposit) * fgtsFinePercent,
  );

  const fixedTermEmployeeDamage =
    input.terminationType === "EARLY_EMPLOYEE_FIXED_TERM" &&
    !input.reciprocalEarlyTerminationClause
      ? input.fixedTermEmployeeDamage
      : 0;
  const totalDeductions = money(
    noticeDeduction +
      inssSalary +
      inssThirteenth +
      irrfSalary +
      irrfThirteenth +
      input.salaryAdvance +
      input.consignments +
      input.otherDeductions +
      fixedTermEmployeeDamage,
  );
  const net = money(Math.max(0, gross - totalDeductions));

  const socialContributionBase = money(
    monthlyTaxableCurrent + thirteenthSalary,
  );
  const adjustedRatPercent = input.ratPercent * input.fapFactor;
  const employerSocialCharges = money(
    socialContributionBase *
      ((input.employerInssPercent +
        adjustedRatPercent +
        input.thirdPartiesPercent) /
        100),
  );
  const employerCost = money(
    gross + employerSocialCharges + fgtsSeveranceDeposit + fgtsFine,
  );
  const deadlineReference =
    input.terminationType === "EMPLOYEE_DEATH" &&
    input.deathKnowledgeDate
      ? dateFromIso(input.deathKnowledgeDate)
      : termination;
  const esocialDeadlineBaseDate = isoFromDate(
    addDays(deadlineReference, 10),
  );
  const paymentDeadlineBaseDate = isoFromDate(
    addDays(termination, 10),
  );
  const esocialIndApurIR: "0" | "1" =
    input.terminationType === "EMPLOYEE_DEATH" &&
    input.deathPaymentRecipient === "SUCCESSORS"
      ? "1"
      : "0";
  const esocialPaymentEvent: "S-1210" | "EFD-REINF" =
    esocialIndApurIR === "1" ? "EFD-REINF" : "S-1210";
  const accruedVacationThird = money(accruedVacation / 3);
  const proportionalVacationThird = money(
    vacationThird - accruedVacationThird,
  );

  const lines: TerminationLine[] = [
    line(
      "6000",
      "Saldo de salário",
      `${salaryBalanceDays} dia(s)`,
      remunerationBase,
      salaryBalance,
      "earning",
      "CP mensal • IR mensal • FGTS mensal",
      "Remuneração mensal dividida por 30 e multiplicada pelos dias de saldo, descontadas as faltas informadas.",
      {
        esocialNatureCode: "6000",
        codIncCP: "11",
        codIncIRRF: "11",
        codIncFGTS: "11",
        esocialOrigin: "S-2299",
      },
    ),
    line(
      "6003",
      "Aviso prévio indenizado",
      `${noticeProjectionDays} dia(s) indenizado(s)`,
      remunerationBase,
      noticeAmount,
      "earning",
      "Sem CP • IR isento • FGTS aviso",
      input.terminationType === "MUTUAL_AGREEMENT"
        ? "No acordo, o aviso indenizado e a projeção foram considerados pela metade dos dias de direito."
        : "Dias proporcionais ao tempo de serviço, limitados a 90, quando o motivo e a modalidade geram aviso indenizado.",
      {
        esocialNatureCode: "6003",
        codIncCP: "00",
        codIncIRRF: "74",
        codIncFGTS: "21",
        esocialOrigin: "S-2299",
      },
    ),
    line(
      "6002",
      "13º salário proporcional — sem projeção",
      `${thirteenthBaseMonths}/12`,
      remunerationBase,
      thirteenthBaseSalary,
      "earning",
      "CP 13º • IR 13º • FGTS 13º",
      "Cada mês com pelo menos 15 dias de serviço até o desligamento foi contado como 1/12, sem misturar a projeção do aviso.",
      {
        esocialNatureCode: "6002",
        codIncCP: "12",
        codIncIRRF: "12",
        codIncFGTS: "12",
        esocialOrigin: "S-2299",
      },
    ),
    line(
      "6001",
      "13º salário sobre aviso indenizado",
      `${thirteenthNoticeMonths}/12`,
      remunerationBase,
      thirteenthNoticeSalary,
      "earning",
      "CP 13º • IR 13º • FGTS aviso",
      "Avos gerados exclusivamente pela projeção do aviso indenizado. O MOS separa esta verba do 13º proporcional comum.",
      {
        esocialNatureCode: "6001",
        codIncCP: "12",
        codIncIRRF: "12",
        codIncFGTS: "21",
        esocialOrigin: "S-2299",
      },
    ),
    line(
      "6007",
      "Férias vencidas indenizadas",
      `${input.accruedVacationPeriods} período(s)`,
      remunerationBase,
      accruedVacation + accruedVacationThird,
      "earning",
      "Sem CP • IR isento • sem FGTS",
      "Natureza 6007 inclui o adicional constitucional. A quantidade de períodos é informada pelo usuário; dobra de férias exige classificação 6004 e não é presumida.",
      {
        esocialNatureCode: "6007",
        codIncCP: "00",
        codIncIRRF: "74",
        codIncFGTS: "00",
        esocialOrigin: "S-2299",
      },
    ),
    line(
      "6006",
      "Férias proporcionais + 1/3",
      `${vacationMonths}/12`,
      remunerationBase,
      proportionalVacation + proportionalVacationThird,
      "earning",
      "Sem CP • IR isento • sem FGTS",
      "Avos do período aquisitivo em curso, considerando fração superior a 14 dias e a projeção do aviso. A natureza 6006 já inclui o adicional constitucional.",
      {
        esocialNatureCode: "6006",
        codIncCP: "00",
        codIncIRRF: "74",
        codIncFGTS: "00",
        esocialOrigin: "S-2299",
      },
    ),
    line(
      "6104",
      "Indenização do art. 479 da CLT",
      remainingFixedTermDays
        ? `${remainingFixedTermDays} dia(s) restantes`
        : "Não aplicável",
      remunerationBase,
      fixedTermIndemnity,
      "earning",
      "Sem CP • IR isento • sem FGTS",
      "Metade da remuneração dos dias restantes no contrato a prazo sem cláusula assecuratória. Com cláusula, aplicam-se os motivos 02/07 e as regras de aviso.",
      {
        esocialNatureCode: "6104",
        codIncCP: "00",
        codIncIRRF: "74",
        codIncFGTS: "00",
        esocialOrigin: "S-2299",
      },
      terminationRules2026.fixedTermEmployerIndemnityFactor,
    ),
    line(
      "9939",
      "Outras verbas tributáveis",
      "Manual",
      input.otherTaxableEarnings,
      input.otherTaxableEarnings,
      "earning",
      "CP mensal • IR mensal • FGTS mensal",
      "Classificação provisória como outros valores tributáveis. Antes de uso oficial, substitua pela natureza específica e homologue as incidências no Motor de Regras.",
      {
        esocialNatureCode: "9939",
        codIncCP: "11",
        codIncIRRF: "11",
        codIncFGTS: "11",
        esocialOrigin: "REVIEW",
        mappingStatus: "REVIEW",
      },
    ),
    line(
      "6129",
      "Outras verbas não remuneratórias",
      "Manual",
      input.otherNonTaxableEarnings,
      input.otherNonTaxableEarnings,
      "earning",
      "Sem CP • IR isento • sem FGTS",
      "Classificação provisória para indenizações ou multas sem natureza específica. Exige documento e homologação antes de qualquer preparação oficial.",
      {
        esocialNatureCode: "6129",
        codIncCP: "00",
        codIncIRRF: "74",
        codIncFGTS: "00",
        esocialOrigin: "REVIEW",
        mappingStatus: "REVIEW",
      },
    ),
    line(
      "9201-M",
      "INSS sobre remuneração mensal",
      "Tabela progressiva 2026",
      monthlyTaxableCumulative,
      inssSalary,
      "deduction",
      "Desconto CP mensal • dedução IR mensal",
      "Calculado progressivamente sobre a base mensal acumulada, abatendo o INSS já retido informado.",
      {
        esocialNatureCode: "9201",
        codIncCP: "31",
        codIncIRRF: "41",
        codIncFGTS: "00",
        esocialOrigin: "S-2299",
      },
    ),
    line(
      "9201-13",
      "INSS sobre 13º salário",
      "Apuração separada",
      thirteenthTaxableCumulative,
      inssThirteenth,
      "deduction",
      "Desconto CP 13º • dedução IR 13º",
      "13º calculado em base separada, abatendo retenção anterior informada.",
      {
        esocialNatureCode: "9201",
        codIncCP: "32",
        codIncIRRF: "42",
        codIncFGTS: "00",
        esocialOrigin: "S-2299",
      },
    ),
    line(
      "9203-M",
      "IRRF sobre remuneração mensal",
      "Tabela 2026",
      monthlyTaxableCumulative,
      irrfSalary,
      "deduction",
      "Retenção IR mensal",
      "Estimativa sobre a base mensal acumulada, com dependentes e abatimento do IRRF já retido.",
      {
        esocialNatureCode: "9203",
        codIncCP: "00",
        codIncIRRF: "31",
        codIncFGTS: "00",
        esocialOrigin: "S-2299",
      },
    ),
    line(
      "9203-13",
      "IRRF sobre 13º salário",
      "Tributação exclusiva",
      thirteenthTaxableCumulative,
      irrfThirteenth,
      "deduction",
      "Retenção IR 13º",
      "Estimativa em base separada. Deve ser conferida com as incidências e deduções oficiais da rubrica.",
      {
        esocialNatureCode: "9203",
        codIncCP: "00",
        codIncIRRF: "32",
        codIncFGTS: "00",
        esocialOrigin: "S-2299",
      },
    ),
    line(
      "6901",
      "Aviso prévio não cumprido",
      `${Math.min(30, noticeDays || 30)} dia(s)`,
      remunerationBase,
      noticeDeduction,
      "deduction",
      "Sem CP • trânsito IR • sem FGTS",
      "Desconto limitado nesta simulação a uma remuneração mensal; dispensa pelo empregador deve zerar a parcela.",
      {
        esocialNatureCode: "6901",
        codIncCP: "00",
        codIncIRRF: "9",
        codIncFGTS: "00",
        esocialOrigin: "S-2299",
      },
    ),
    line(
      "9200",
      "Adiantamentos",
      "Informado",
      input.salaryAdvance,
      input.salaryAdvance,
      "deduction",
      "Sem CP • trânsito IR • sem FGTS",
      "Valor informado pelo usuário, sujeito à comprovação e aos limites legais.",
      {
        esocialNatureCode: "9200",
        codIncCP: "00",
        codIncIRRF: "9",
        codIncFGTS: "00",
        esocialOrigin: "S-2299",
      },
    ),
    line(
      "9254",
      "Empréstimos consignados",
      "Informado",
      input.consignments,
      input.consignments,
      "deduction",
      "Sem CP • trânsito IR • sem FGTS",
      "Classificado como consignado comum. Empréstimo do Programa Crédito do Trabalhador/eConsignado exige natureza 9253, campos próprios e fluxo do FGTS Digital.",
      {
        esocialNatureCode: "9254",
        codIncCP: "00",
        codIncIRRF: "9",
        codIncFGTS: "00",
        esocialOrigin: "REVIEW",
        mappingStatus: "REVIEW",
      },
    ),
    line(
      "9299",
      "Outros descontos",
      "Informado",
      input.otherDeductions,
      input.otherDeductions,
      "deduction",
      "Sem CP • trânsito IR • sem FGTS",
      "Natureza genérica para descontos não classificados. Exige fundamento, autorização e conferência dos limites de compensação.",
      {
        esocialNatureCode: "9299",
        codIncCP: "00",
        codIncIRRF: "9",
        codIncFGTS: "00",
        esocialOrigin: "REVIEW",
        mappingStatus: "REVIEW",
      },
    ),
    line(
      "6904",
      "Multa do art. 480 da CLT",
      "Dano comprovado",
      fixedTermEmployeeDamage,
      fixedTermEmployeeDamage,
      "deduction",
      "Sem CP • trânsito IR • sem FGTS",
      "Somente para término antecipado pelo empregado, sem cláusula assecuratória, com dano comprovado e limitado legalmente.",
      {
        esocialNatureCode: "6904",
        codIncCP: "00",
        codIncIRRF: "9",
        codIncFGTS: "00",
        esocialOrigin: "S-2299",
      },
    ),
    line(
      "FGTS-11",
      "FGTS sobre bases mensais rescisórias",
      `${money(fgtsRate * 100)}%`,
      fgtsMonthlyBase,
      fgtsMonthlyDeposit,
      "employer",
      "Totalizador FGTS mensal",
      "Estimativa do depósito a partir das rubricas com codIncFGTS 11. O retorno S-5003/FGTS Digital prevalece.",
      {
        esocialNatureCode: "—",
        codIncCP: "—",
        codIncIRRF: "—",
        codIncFGTS: "11",
        esocialOrigin: "S-5003",
        mappingStatus: "TOTALIZER",
      },
      fgtsRate,
    ),
    line(
      "FGTS-12",
      "FGTS sobre 13º proporcional",
      `${money(fgtsRate * 100)}%`,
      fgtsThirteenthBase,
      fgtsThirteenthDeposit,
      "employer",
      "Totalizador FGTS 13º",
      "Estimativa a partir das rubricas com codIncFGTS 12.",
      {
        esocialNatureCode: "—",
        codIncCP: "—",
        codIncIRRF: "—",
        codIncFGTS: "12",
        esocialOrigin: "S-5003",
        mappingStatus: "TOTALIZER",
      },
      fgtsRate,
    ),
    line(
      "FGTS-21",
      "FGTS sobre aviso e projeção de 13º",
      `${money(fgtsRate * 100)}%`,
      fgtsNoticeBase,
      fgtsNoticeDeposit,
      "employer",
      "Totalizador FGTS aviso",
      "O MOS agrupa aviso indenizado e projeção de 13º na incidência FGTS 21.",
      {
        esocialNatureCode: "—",
        codIncCP: "—",
        codIncIRRF: "—",
        codIncFGTS: "21",
        esocialOrigin: "S-5003",
        mappingStatus: "TOTALIZER",
      },
      fgtsRate,
    ),
    line(
      "6101",
      "Indenização compensatória do FGTS",
      `${money(fgtsFinePercent * 100)}%`,
      input.fgtsBalance + fgtsSeveranceDeposit,
      fgtsFine,
      "employer",
      "Multa rescisória FGTS",
      "Aplicada ao saldo informado acrescido do depósito rescisório estimado. O saldo oficial para fins rescisórios deve ser conferido no FGTS Digital.",
      {
        esocialNatureCode: "6101",
        codIncCP: "00",
        codIncIRRF: "74",
        codIncFGTS: "00",
        esocialOrigin: "S-5003",
        mappingStatus: "TOTALIZER",
      },
      fgtsFinePercent,
    ),
    line(
      "ENC-PATRONAL",
      "Encargos patronais rescisórios",
      `${money(
        input.employerInssPercent +
          adjustedRatPercent +
          input.thirdPartiesPercent,
      )}%`,
      socialContributionBase,
      employerSocialCharges,
      "employer",
      "Previdenciário / terceiros",
      "Estimativa com contribuição patronal, RAT × FAP e terceiros cadastrados no Regime Tributário.",
      {
        esocialNatureCode: "—",
        codIncCP: "11/12",
        codIncIRRF: "—",
        codIncFGTS: "—",
        esocialOrigin: "S-5001",
        mappingStatus: "TOTALIZER",
      },
    ),
  ].filter(
    (item) =>
      item.amount > 0 ||
      ["6000", "6002", "6006", "FGTS-11"].includes(item.code),
  );

  const warnings = [
    "Cálculo administrativo para conferência: não fecha a rescisão, não altera o cadastro do funcionário e não transmite o S-2299.",
    "Convenção coletiva, estabilidade, afastamentos, faltas, médias, rubricas e decisões judiciais devem ser conferidos pelo RH e pela contabilidade.",
    `Classificação cruzada com ${terminationRules2026.mosVersion} e ${terminationRules2026.layoutVersion}; o eSocial organiza declaração e incidências, enquanto as fórmulas vêm da legislação trabalhista, previdenciária e tributária.`,
    `Prazo-base operacional do S-2299: ${esocialDeadlineBaseDate}. Se a data não for dia útil fiscal, o MOS determina antecipação; esta prévia não transmite o evento.`,
  ];
  if (!input.historySourceCount && input.usePayrollAverage) {
    warnings.push(
      "Nenhum histórico individual do Cálculo de Folha foi encontrado; a média variável permaneceu manual.",
    );
  }
  if (fgtsFinePercent > 0 && input.fgtsBalance <= 0) {
    warnings.push(
      "Informe o saldo oficial do FGTS para fins rescisórios; sem ele, a indenização compensatória está incompleta.",
    );
  }
  if (
    input.thirteenthMonthsOverride !== null ||
    input.thirteenthNoticeMonthsOverride !== null ||
    input.vacationMonthsOverride !== null
  ) {
    warnings.push(
      "Há avos substituídos manualmente. Registre a justificativa e mantenha a alteração na trilha de auditoria.",
    );
  }
  if (
    projectedTermination.getUTCFullYear() !== termination.getUTCFullYear()
  ) {
    warnings.push(
      "A projeção do aviso atravessa o ano-calendário; o motor separou os avos gerados pela projeção, mas a competência e o demonstrativo devem ser conferidos antes do fechamento.",
    );
  }
  if (
    input.otherTaxableEarnings > 0 ||
    input.otherNonTaxableEarnings > 0 ||
    input.otherDeductions > 0 ||
    input.consignments > 0
  ) {
    warnings.push(
      "Há rubricas manuais com mapeamento marcado para revisão. Defina natureza e incidências definitivas no Motor de Regras antes de qualquer futura preparação oficial.",
    );
  }
  if (
    ["EARLY_EMPLOYER_FIXED_TERM", "EARLY_EMPLOYEE_FIXED_TERM"].includes(
      input.terminationType,
    )
  ) {
    warnings.push(
      input.reciprocalEarlyTerminationClause
        ? "Contrato a prazo marcado com cláusula assecuratória: conforme o MOS, o motivo foi convertido para 02 ou 07 e as regras de aviso substituem as indenizações dos arts. 479/480."
        : "Contrato a prazo sem cláusula assecuratória: mantidos os motivos 03/04 e o tratamento específico dos arts. 479/480.",
    );
  }
  if (input.employerParameterSource === "ESTIMATE") {
    warnings.push(
      "Os encargos patronais usam parâmetros estimados; complete o Regime Tributário da empresa para uma apuração mais confiável.",
    );
  }
  if (input.terminationType === "EMPLOYEE_DEATH") {
    warnings.push(
      "No falecimento, o MOS exige que a data de desligamento seja a data do óbito; o prazo excepcional parte da ciência do empregador quando o conhecimento é extemporâneo.",
    );
    warnings.push(
      input.deathPaymentRecipient === "SUCCESSORS"
        ? "Cenário de pagamento a sucessores: prévia marcada com indApurIR=1, sem S-1210, e identificação dos recebedores destinada à EFD-Reinf. Nenhum evento será enviado."
        : "Cenário de pagamento no CPF do empregado falecido: futura escrituração usa o CPF do falecido e, após homologação, relaciona o pagamento no S-1210. Nenhum evento será enviado agora.",
    );
    if (input.deathRelatedToWork && !input.catNumber) {
      warnings.push(
        "O falecimento foi marcado como relacionado ao trabalho, mas a referência da CAT não foi informada.",
      );
    }
  }

  return {
    remunerationBase,
    projectedTerminationDate: isoFromDate(projectedTermination),
    serviceYears,
    noticeDays,
    noticeProjectionDays,
    salaryBalanceDays,
    thirteenthMonths,
    thirteenthBaseMonths,
    thirteenthNoticeMonths,
    vacationMonths,
    remainingFixedTermDays,
    salaryBalance,
    noticeAmount,
    noticeDeduction,
    thirteenthBaseSalary,
    thirteenthNoticeSalary,
    thirteenthSalary,
    accruedVacation,
    proportionalVacation,
    vacationThird,
    fixedTermIndemnity,
    otherEarnings,
    gross,
    inssSalary,
    inssThirteenth,
    irrfSalary,
    irrfThirteenth,
    fgtsMonthlyBase,
    fgtsThirteenthBase,
    fgtsNoticeBase,
    fgtsSeveranceBase,
    fgtsMonthlyDeposit,
    fgtsThirteenthDeposit,
    fgtsNoticeDeposit,
    fgtsSeveranceDeposit,
    fgtsFinePercent,
    fgtsFine,
    employerSocialCharges,
    totalDeductions,
    net,
    employerCost,
    esocialReasonCode: esocialReasonCode(input),
    esocialDeadlineBaseDate,
    paymentDeadlineBaseDate,
    esocialIndApurIR,
    esocialPaymentEvent,
    lines,
    rulesVersion: terminationRules2026.version,
    mosVersion: terminationRules2026.mosVersion,
    layoutVersion: terminationRules2026.layoutVersion,
    warnings,
  };
}
