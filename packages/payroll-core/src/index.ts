// Motor compartilhado pelo portal Cloudflare e pelo núcleo ERP NestJS.
export type PayrollAdditionalType =
  | "NONE"
  | "INSALUBRITY"
  | "HAZARD";

export type FgtsCategory = "STANDARD" | "APPRENTICE";

export type PayrollParameterSource = "COMPANY_PROFILE" | "ESTIMATE";

export type PayrollInput = {
  employeeName: string;
  employeeCode: string;
  role: string;
  workName: string;
  competence: string;
  baseSalary: number;
  monthlyHours: number;
  overtimeHours: number;
  overtimePercent: number;
  additionalType: PayrollAdditionalType;
  insalubrityDegree: 10 | 20 | 40;
  insalubrityBase: number;
  taxableAdditions: number;
  nonTaxableEarnings: number;
  dependents: number;
  pensionDeduction: number;
  salaryAdvance: number;
  consignments: number;
  unionContribution: number;
  otherDeductions: number;
  fgtsCategory: FgtsCategory;
  employerInssPercent: number;
  ratPercent: number;
  fapFactor: number;
  thirdPartiesPercent: number;
  employerParameterSource: PayrollParameterSource;
};

export type PayrollLine = {
  code: string;
  label: string;
  base: number;
  rate?: number;
  amount: number;
  kind: "earning" | "deduction" | "employer" | "provision";
  note: string;
};

export type PayrollResult = {
  gross: number;
  taxableGross: number;
  overtimeAmount: number;
  additionalAmount: number;
  inss: number;
  irrfBeforeReduction: number;
  irrfReduction: number;
  irrf: number;
  fgts: number;
  fgtsRate: number;
  totalDeductions: number;
  net: number;
  employerInss: number;
  ratAdjusted: number;
  ratAdjustedPercent: number;
  thirdParties: number;
  employerCharges: number;
  provisions: number;
  totalEmployerCost: number;
  irrfDeductionMethod: "Deduções legais" | "Desconto simplificado";
  lines: PayrollLine[];
  rulesVersion: string;
  warnings: string[];
};

export const payrollRules2026 = {
  effectiveFrom: "2026-01",
  version: "BR-FOLHA-2026.2",
  minimumWage: 1621,
  inssCeiling: 8475.55,
  inssBrackets: [
    { limit: 1621, rate: 0.075 },
    { limit: 2902.84, rate: 0.09 },
    { limit: 4354.27, rate: 0.12 },
    { limit: 8475.55, rate: 0.14 },
  ],
  irrfBrackets: [
    { limit: 2428.8, rate: 0, deduction: 0 },
    { limit: 2826.65, rate: 0.075, deduction: 182.16 },
    { limit: 3751.05, rate: 0.15, deduction: 394.16 },
    { limit: 4664.68, rate: 0.225, deduction: 675.49 },
    { limit: Number.POSITIVE_INFINITY, rate: 0.275, deduction: 908.73 },
  ],
  irrfDependentDeduction: 189.59,
  irrfSimplifiedDeduction: 607.2,
  irrfFullReductionLimit: 5000,
  irrfPartialReductionLimit: 7350,
  irrfPartialReductionFixed: 978.62,
  irrfPartialReductionFactor: 0.133145,
  standardFgtsRate: 0.08,
  apprenticeFgtsRate: 0.02,
  hazardRate: 0.3,
  overtimeMinimumPercent: 50,
} as const;

const money = (value: number) =>
  Math.round(
    ((Number.isFinite(value) ? value : 0) + 1e-9) * 100,
  ) / 100;

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

function normalizeCompetence(value: unknown) {
  const competence = String(value ?? "").trim();
  if (/^\d{4}-\d{2}$/.test(competence)) return `${competence}-01`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(competence)) {
    return `${competence.slice(0, 7)}-01`;
  }
  return "";
}

export function normalizePayrollInput(
  raw: Partial<PayrollInput>,
): PayrollInput {
  const additionalType: PayrollAdditionalType = [
    "NONE",
    "INSALUBRITY",
    "HAZARD",
  ].includes(String(raw.additionalType))
    ? (raw.additionalType as PayrollAdditionalType)
    : "NONE";
  const degree = numeric(raw.insalubrityDegree, 20);
  const insalubrityDegree: 10 | 20 | 40 =
    degree === 10 ? 10 : degree === 40 ? 40 : 20;
  const fgtsCategory: FgtsCategory =
    raw.fgtsCategory === "APPRENTICE" ? "APPRENTICE" : "STANDARD";

  return {
    employeeName: String(raw.employeeName ?? "").trim().slice(0, 200),
    employeeCode: String(raw.employeeCode ?? "").trim().slice(0, 80),
    role: String(raw.role ?? "").trim().slice(0, 160),
    workName: String(raw.workName ?? "").trim().slice(0, 200),
    competence: normalizeCompetence(raw.competence),
    baseSalary: nonNegative(raw.baseSalary),
    monthlyHours: bounded(raw.monthlyHours, 1, 744, 220),
    overtimeHours: bounded(raw.overtimeHours, 0, 300, 0),
    overtimePercent: bounded(raw.overtimePercent, 0, 400, 50),
    additionalType,
    insalubrityDegree,
    insalubrityBase: nonNegative(
      raw.insalubrityBase,
      payrollRules2026.minimumWage,
    ),
    taxableAdditions: nonNegative(raw.taxableAdditions),
    nonTaxableEarnings: nonNegative(raw.nonTaxableEarnings),
    dependents: Math.floor(bounded(raw.dependents, 0, 99, 0)),
    pensionDeduction: nonNegative(raw.pensionDeduction),
    salaryAdvance: nonNegative(raw.salaryAdvance),
    consignments: nonNegative(raw.consignments),
    unionContribution: nonNegative(raw.unionContribution),
    otherDeductions: nonNegative(raw.otherDeductions),
    fgtsCategory,
    employerInssPercent: bounded(raw.employerInssPercent, 0, 50, 20),
    ratPercent: bounded(raw.ratPercent, 0, 10, 2),
    fapFactor: bounded(raw.fapFactor, 0.5, 2, 1),
    thirdPartiesPercent: bounded(raw.thirdPartiesPercent, 0, 20, 5.8),
    employerParameterSource:
      raw.employerParameterSource === "COMPANY_PROFILE"
        ? "COMPANY_PROFILE"
        : "ESTIMATE",
  };
}

export function validatePayrollInput(input: PayrollInput) {
  const errors: string[] = [];
  if (!input.employeeName) errors.push("Informe o nome do funcionário.");
  if (!input.competence) {
    errors.push("Informe uma competência válida no formato AAAA-MM.");
  }
  if (input.baseSalary <= 0) {
    errors.push("O salário-base deve ser maior que zero.");
  }
  if (input.overtimeHours > 0 && input.overtimePercent < 50) {
    errors.push(
      "O adicional de hora extra informado é inferior ao mínimo geral de 50%.",
    );
  }
  return errors;
}

export function calculateProgressiveInss(base: number) {
  const capped = Math.min(nonNegative(base), payrollRules2026.inssCeiling);
  let previous = 0;
  let total = 0;
  for (const bracket of payrollRules2026.inssBrackets) {
    const portion = Math.max(0, Math.min(capped, bracket.limit) - previous);
    total += portion * bracket.rate;
    previous = bracket.limit;
    if (capped <= bracket.limit) break;
  }
  return money(total);
}

function calculateIrrf(base: number) {
  const normalizedBase = nonNegative(base);
  const bracket = payrollRules2026.irrfBrackets.find(
    (candidate) => normalizedBase <= candidate.limit,
  )!;
  return money(
    Math.max(0, normalizedBase * bracket.rate - bracket.deduction),
  );
}

export function calculatePayroll(rawInput: PayrollInput): PayrollResult {
  const input = normalizePayrollInput(rawInput);
  const salary = input.baseSalary;
  const overtimeFactor = 1 + input.overtimePercent / 100;
  const overtimeAmount = money(
    (salary / input.monthlyHours) * input.overtimeHours * overtimeFactor,
  );
  const additionalAmount =
    input.additionalType === "INSALUBRITY"
      ? money(
          input.insalubrityBase * (input.insalubrityDegree / 100),
        )
      : input.additionalType === "HAZARD"
        ? money(salary * payrollRules2026.hazardRate)
        : 0;
  const taxableGross = money(
    salary +
      overtimeAmount +
      additionalAmount +
      input.taxableAdditions,
  );
  const gross = money(taxableGross + input.nonTaxableEarnings);

  const inss = calculateProgressiveInss(taxableGross);
  const legalDeductions = money(
    inss +
      input.dependents * payrollRules2026.irrfDependentDeduction +
      input.pensionDeduction,
  );
  const useSimplified =
    payrollRules2026.irrfSimplifiedDeduction > legalDeductions;
  const irrfBase = money(
    Math.max(
      0,
      taxableGross -
        (useSimplified
          ? payrollRules2026.irrfSimplifiedDeduction
          : legalDeductions),
    ),
  );
  const irrfBeforeReduction = calculateIrrf(irrfBase);
  const possibleReduction =
    taxableGross <= payrollRules2026.irrfFullReductionLimit
      ? irrfBeforeReduction
      : taxableGross <= payrollRules2026.irrfPartialReductionLimit
        ? Math.max(
            0,
            payrollRules2026.irrfPartialReductionFixed -
              payrollRules2026.irrfPartialReductionFactor * taxableGross,
          )
        : 0;
  const irrfReduction = money(
    Math.min(irrfBeforeReduction, possibleReduction),
  );
  const irrf = money(Math.max(0, irrfBeforeReduction - irrfReduction));

  const fgtsRate =
    input.fgtsCategory === "APPRENTICE"
      ? payrollRules2026.apprenticeFgtsRate
      : payrollRules2026.standardFgtsRate;
  const fgts = money(taxableGross * fgtsRate);
  const totalDeductions = money(
    inss +
      irrf +
      input.pensionDeduction +
      input.salaryAdvance +
      input.consignments +
      input.unionContribution +
      input.otherDeductions,
  );
  const net = money(Math.max(0, gross - totalDeductions));

  const employerInss = money(
    taxableGross * (input.employerInssPercent / 100),
  );
  const ratAdjustedPercent = money(input.ratPercent * input.fapFactor);
  const ratAdjusted = money(
    taxableGross * (ratAdjustedPercent / 100),
  );
  const thirdParties = money(
    taxableGross * (input.thirdPartiesPercent / 100),
  );
  const employerCharges = money(
    employerInss + ratAdjusted + thirdParties,
  );

  const thirteenthProvision = money(taxableGross / 12);
  const vacationProvision = money(taxableGross / 12);
  const vacationThirdProvision = money(vacationProvision / 3);
  const provisions = money(
    thirteenthProvision + vacationProvision + vacationThirdProvision,
  );
  const totalEmployerCost = money(
    gross + fgts + employerCharges + provisions,
  );

  const warnings = [
    "Cálculo administrativo: validar eventos, incidências e valores com a contabilidade antes do fechamento oficial.",
    "A versão das regras fica gravada com a memória de cálculo para permitir conferência e auditoria.",
  ];
  if (input.employerParameterSource === "ESTIMATE") {
    warnings.push(
      "Encargos patronais em modo estimado: confirme FPAS, outras entidades e fundos, RAT e FAP no Regime Tributário.",
    );
  }
  if (input.additionalType === "INSALUBRITY") {
    warnings.push(
      "Insalubridade exige caracterização técnica e conferência da base aplicável à categoria e à convenção coletiva.",
    );
  }
  if (input.additionalType === "HAZARD") {
    warnings.push(
      "Periculosidade exige enquadramento técnico; a prévia usa 30% do salário-base informado.",
    );
  }
  if (input.overtimeHours > 0 && input.overtimePercent < 50) {
    warnings.push(
      "O percentual de hora extra está abaixo do mínimo geral de 50%; revise a legislação e a convenção coletiva.",
    );
  }
  if (input.unionContribution > 0) {
    warnings.push(
      "Contribuição sindical informada: confirme autorização e fundamento aplicável antes do desconto.",
    );
  }
  if (input.consignments > taxableGross * 0.35) {
    warnings.push(
      "Consignados acima de 35% da remuneração tributável informada: revisar margem e regras do contrato.",
    );
  }

  const additionalLine: PayrollLine | null =
    input.additionalType === "INSALUBRITY"
      ? {
          code: `115${input.insalubrityDegree}`,
          label: `Adicional de insalubridade — ${input.insalubrityDegree}%`,
          base: input.insalubrityBase,
          rate: input.insalubrityDegree / 100,
          amount: additionalAmount,
          kind: "earning",
          note:
            "Base informada para a simulação; depende de caracterização técnica e conferência coletiva.",
        }
      : input.additionalType === "HAZARD"
        ? {
            code: "11630",
            label: "Adicional de periculosidade — 30%",
            base: salary,
            rate: payrollRules2026.hazardRate,
            amount: additionalAmount,
            kind: "earning",
            note: "Trinta por cento sobre o salário-base informado.",
          }
        : null;

  const lines: Array<PayrollLine | null> = [
    {
      code: "10000",
      label: "Salário mensal",
      base: salary,
      amount: salary,
      kind: "earning",
      note: "Remuneração mensal informada no Cadastro de Funcionários.",
    },
    additionalLine,
    {
      code: "11050",
      label: "Horas extras",
      base: salary / input.monthlyHours,
      rate: overtimeFactor,
      amount: overtimeAmount,
      kind: "earning",
      note: `${input.overtimeHours} h com adicional de ${input.overtimePercent}%.`,
    },
    {
      code: "11990",
      label: "Outros proventos tributáveis",
      base: input.taxableAdditions,
      amount: input.taxableAdditions,
      kind: "earning",
      note: "Incide na prévia de INSS, IRRF e FGTS.",
    },
    {
      code: "12000",
      label: "Proventos não tributáveis",
      base: input.nonTaxableEarnings,
      amount: input.nonTaxableEarnings,
      kind: "earning",
      note: "O tratamento definitivo depende da natureza real da rubrica.",
    },
    {
      code: "15000",
      label: "INSS do empregado",
      base: taxableGross,
      amount: inss,
      kind: "deduction",
      note: "Cálculo progressivo pelas faixas vigentes em 2026.",
    },
    {
      code: "15500",
      label: "IRRF mensal",
      base: irrfBase,
      amount: irrf,
      kind: "deduction",
      note: `${useSimplified ? "Desconto simplificado" : "Deduções legais"}; redução 2026 de ${money(irrfReduction).toFixed(2)}.`,
    },
    {
      code: "16000",
      label: "Pensão alimentícia",
      base: input.pensionDeduction,
      amount: input.pensionDeduction,
      kind: "deduction",
      note: "Valor informado como dedutível e descontado na prévia.",
    },
    {
      code: "16900",
      label: "Adiantamento salarial",
      base: input.salaryAdvance,
      amount: input.salaryAdvance,
      kind: "deduction",
      note: "Compensação do valor previamente pago.",
    },
    {
      code: "16950",
      label: "Consignados e convênios",
      base: input.consignments,
      amount: input.consignments,
      kind: "deduction",
      note: "Revisar contrato, margem e natureza eSocial aplicável.",
    },
    {
      code: "16400",
      label: "Contribuição sindical",
      base: input.unionContribution,
      amount: input.unionContribution,
      kind: "deduction",
      note: "Exige validação de autorização e enquadramento.",
    },
    {
      code: "16890",
      label: "Outros descontos",
      base: input.otherDeductions,
      amount: input.otherDeductions,
      kind: "deduction",
      note: "Rubricas devem ser detalhadas antes do fechamento oficial.",
    },
    {
      code: "90000",
      label: `FGTS mensal — ${money(fgtsRate * 100)}%`,
      base: taxableGross,
      rate: fgtsRate,
      amount: fgts,
      kind: "employer",
      note:
        input.fgtsCategory === "APPRENTICE"
          ? "Alíquota estimada de 2% para contrato de aprendizagem."
          : "Alíquota padrão estimada de 8%.",
    },
    {
      code: "94010",
      label: "Contribuição patronal",
      base: taxableGross,
      rate: input.employerInssPercent / 100,
      amount: employerInss,
      kind: "employer",
      note: `Parâmetro patronal informado: ${input.employerInssPercent}%.`,
    },
    {
      code: "94020",
      label: "RAT ajustado",
      base: taxableGross,
      rate: ratAdjustedPercent / 100,
      amount: ratAdjusted,
      kind: "employer",
      note: `RAT ${input.ratPercent}% × FAP ${input.fapFactor} = ${ratAdjustedPercent}%.`,
    },
    {
      code: "94030",
      label: "Outras entidades e fundos",
      base: taxableGross,
      rate: input.thirdPartiesPercent / 100,
      amount: thirdParties,
      kind: "employer",
      note: `Percentual de terceiros informado: ${input.thirdPartiesPercent}%.`,
    },
    {
      code: "95013",
      label: "Provisão mensal de 13º",
      base: taxableGross,
      rate: 1 / 12,
      amount: thirteenthProvision,
      kind: "provision",
      note: "Estimativa mensal de 1/12 da remuneração tributável.",
    },
    {
      code: "95030",
      label: "Provisão mensal de férias",
      base: taxableGross,
      rate: 1 / 12,
      amount: vacationProvision,
      kind: "provision",
      note: "Estimativa mensal de 1/12 da remuneração tributável.",
    },
    {
      code: "95033",
      label: "Provisão do terço de férias",
      base: vacationProvision,
      rate: 1 / 3,
      amount: vacationThirdProvision,
      kind: "provision",
      note: "Um terço da provisão mensal de férias.",
    },
  ];

  return {
    gross,
    taxableGross,
    overtimeAmount,
    additionalAmount,
    inss,
    irrfBeforeReduction,
    irrfReduction,
    irrf,
    fgts,
    fgtsRate,
    totalDeductions,
    net,
    employerInss,
    ratAdjusted,
    ratAdjustedPercent,
    thirdParties,
    employerCharges,
    provisions,
    totalEmployerCost,
    irrfDeductionMethod: useSimplified
      ? "Desconto simplificado"
      : "Deduções legais",
    lines: lines.filter(
      (line): line is PayrollLine => Boolean(line && line.amount > 0),
    ),
    rulesVersion: payrollRules2026.version,
    warnings,
  };
}
