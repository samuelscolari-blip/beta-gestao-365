import {
  calculateTermination,
  normalizeTerminationInput,
  terminationNoticeLabels,
  terminationRules2026,
  terminationTypeLabels,
  validateTerminationInput,
  type TerminationInput,
} from "../../lib/termination";
import {
  createRecord,
  listRecords,
  RecordStoreError,
  type StoredRecord,
} from "../../../db/records";
import {
  actorFrom,
  requireSoleAdmin,
} from "../../lib/server-access";

class TerminationApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "TerminationApiError";
  }
}

type PayrollSummary = {
  overtimeAmount?: unknown;
  additionalAmount?: unknown;
  taxableGross?: unknown;
  inss?: unknown;
  irrf?: unknown;
};

const money = (value: number) =>
  Math.round(((Number.isFinite(value) ? value : 0) + 1e-9) * 100) / 100;

const numeric = (value: unknown, fallback = 0) => {
  const normalized = String(value ?? "").trim().replace(",", ".");
  if (!normalized) return fallback;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
};

function asObject(value: unknown) {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function payrollVariableValue(record: StoredRecord) {
  const summary = asObject(
    record.payload.calculationSummary,
  ) as PayrollSummary;
  const input = asObject(record.payload.input);
  return money(
    numeric(summary.overtimeAmount) +
      numeric(summary.additionalAmount) +
      numeric(input.taxableAdditions),
  );
}

function payrollEmployeeCode(record: StoredRecord) {
  const input = asObject(record.payload.input);
  return String(
    record.payload.employeeCode ?? input.employeeCode ?? "",
  ).trim();
}

function payrollCompetence(record: StoredRecord) {
  const input = asObject(record.payload.input);
  return String(
    record.payload.competence ?? input.competence ?? record.recordDate,
  ).slice(0, 7);
}

function companyParameter(
  profile: Record<string, unknown>,
  key: string,
  fallback: number,
) {
  return numeric(profile[key], fallback);
}

async function sha256Json(value: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function errorResponse(error: unknown) {
  const status =
    error instanceof TerminationApiError
      ? error.status
      : error instanceof RecordStoreError
        ? error.status
        : 500;
  return Response.json(
    {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Erro interno ao processar a prévia rescisória.",
      code:
        error instanceof TerminationApiError
          ? error.code
          : error instanceof RecordStoreError
            ? error.code
            : "TERMINATION_PROCESSING_ERROR",
    },
    { status },
  );
}

export async function POST(request: Request) {
  const denied = requireSoleAdmin(request);
  if (denied) return denied;

  try {
    const body = (await request.json()) as {
      input?: Partial<TerminationInput>;
    };
    const requested = normalizeTerminationInput(body.input || {});
    if (!requested.employeeRecordId) {
      throw new TerminationApiError(
        "Selecione um funcionário do Cadastro de Funcionários.",
        "EMPLOYEE_REQUIRED",
      );
    }

    const [peopleResult, payrollResult, settingsResult] = await Promise.all([
      listRecords("people"),
      listRecords("payroll"),
      listRecords("settings"),
    ]);
    const people = peopleResult as StoredRecord[];
    const payrollRecords = payrollResult as StoredRecord[];
    const settingsRecords = settingsResult as StoredRecord[];
    const person = people.find(
      (record) => record.id === requested.employeeRecordId,
    );
    if (!person) {
      throw new TerminationApiError(
        "O funcionário selecionado não foi encontrado.",
        "EMPLOYEE_NOT_FOUND",
        404,
      );
    }
    const employeeCode = String(
      person.payload.employeeCode || person.reference,
    ).trim();
    const employeePayroll = payrollRecords
      .filter(
        (record) =>
          record.payload.recordType !== "BATCH" &&
          payrollEmployeeCode(record) === employeeCode,
      )
      .sort((a, b) => b.recordDate.localeCompare(a.recordDate))
      .slice(0, 12);
    const variableHistory: number[] = employeePayroll
      .map(payrollVariableValue)
      .filter((value) => Number.isFinite(value));
    const payrollAverage = variableHistory.length
      ? money(
          variableHistory.reduce((total, value) => total + value, 0) /
            variableHistory.length,
        )
      : 0;
    const terminationCompetence = requested.terminationDate.slice(0, 7);
    const competencePayroll = employeePayroll.find(
      (record) => payrollCompetence(record) === terminationCompetence,
    );
    const competenceSummary = asObject(
      competencePayroll?.payload.calculationSummary,
    ) as PayrollSummary;
    const profile = settingsRecords[0]?.payload || {};
    const profileKeys = [
      "employerInssPercent",
      "rat",
      "fap",
      "thirdPartiesPercent",
    ];
    const profileComplete = profileKeys.every(
      (key) => String(profile[key] ?? "").trim(),
    );

    const input = normalizeTerminationInput({
      ...requested,
      employeeName: String(person.payload.name || person.title),
      employeeCode,
      role: String(person.payload.role || ""),
      admissionDate: String(person.payload.admissionDate || ""),
      contractType: String(person.payload.contractType || ""),
      union: String(person.payload.union || ""),
      collectiveAgreement: String(
        person.payload.collectiveAgreement || "",
      ),
      baseSalary: numeric(person.payload.salary),
      dependents: numeric(person.payload.dependents),
      fgtsCategory: /aprendiz/i.test(
        String(person.payload.contractType || ""),
      )
        ? "APPRENTICE"
        : "STANDARD",
      variableAverage:
        requested.usePayrollAverage && variableHistory.length
          ? payrollAverage
          : requested.variableAverage,
      historySourceCount: employeePayroll.length,
      priorMonthlyTaxableBase:
        requested.useCompetencePayrollBase && competencePayroll
          ? numeric(competenceSummary.taxableGross)
          : requested.priorMonthlyTaxableBase,
      priorMonthlyInss:
        requested.useCompetencePayrollBase && competencePayroll
          ? numeric(competenceSummary.inss)
          : requested.priorMonthlyInss,
      priorMonthlyIrrf:
        requested.useCompetencePayrollBase && competencePayroll
          ? numeric(competenceSummary.irrf)
          : requested.priorMonthlyIrrf,
      employerInssPercent: companyParameter(
        profile,
        "employerInssPercent",
        requested.employerInssPercent,
      ),
      ratPercent: companyParameter(
        profile,
        "rat",
        requested.ratPercent,
      ),
      fapFactor: companyParameter(
        profile,
        "fap",
        requested.fapFactor,
      ),
      thirdPartiesPercent: companyParameter(
        profile,
        "thirdPartiesPercent",
        requested.thirdPartiesPercent,
      ),
      employerParameterSource: profileComplete
        ? "COMPANY_PROFILE"
        : "ESTIMATE",
    });
    const errors = validateTerminationInput(input);
    if (errors.length) {
      throw new TerminationApiError(
        errors.join(" "),
        "INVALID_TERMINATION_INPUT",
      );
    }

    const result = calculateTermination(input);
    const terminationCode = `RES-${input.terminationDate.replaceAll(
      "-",
      "",
    )}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const processedAt = new Date().toISOString();
    const resultHash = await sha256Json({
      input,
      result,
      employeeRecordId: person.id,
      payrollRecordIds: employeePayroll.map((record) => record.id),
      processedAt,
    });
    const status = "Prévia — não transmitida";
    const payload = {
      terminationCode,
      employeeName: input.employeeName,
      employeeCode: input.employeeCode,
      role: input.role,
      admissionDate: input.admissionDate,
      terminationDate: input.terminationDate,
      deathDate: input.deathDate,
      deathKnowledgeDate: input.deathKnowledgeDate,
      deathRelatedToWork: input.deathRelatedToWork ? "Sim" : "Não",
      catNumber: input.catNumber,
      deathPaymentRecipient: input.deathPaymentRecipient,
      contractType: input.contractType,
      expectedContractEnd: input.expectedContractEnd,
      reciprocalEarlyTerminationClause:
        input.reciprocalEarlyTerminationClause ? "Sim" : "Não",
      projectedTerminationDate: result.projectedTerminationDate,
      terminationType: input.terminationType,
      terminationTypeLabel:
        terminationTypeLabels[input.terminationType],
      esocialReasonCode: result.esocialReasonCode,
      noticeType: input.noticeType,
      noticeTypeLabel: terminationNoticeLabels[input.noticeType],
      noticeDays: result.noticeDays,
      noticeProjectionDays: result.noticeProjectionDays,
      baseSalary: input.baseSalary,
      variableAverage: input.variableAverage,
      remunerationBase: result.remunerationBase,
      salaryBalance: result.salaryBalance,
      noticeAmount: result.noticeAmount,
      thirteenthBaseMonths: result.thirteenthBaseMonths,
      thirteenthNoticeMonths: result.thirteenthNoticeMonths,
      thirteenthBaseSalary: result.thirteenthBaseSalary,
      thirteenthNoticeSalary: result.thirteenthNoticeSalary,
      thirteenthSalary: result.thirteenthSalary,
      accruedVacation: result.accruedVacation,
      proportionalVacation: result.proportionalVacation,
      vacationThird: result.vacationThird,
      fixedTermIndemnity: result.fixedTermIndemnity,
      grossAmount: result.gross,
      inss: money(result.inssSalary + result.inssThirteenth),
      irrf: money(result.irrfSalary + result.irrfThirteenth),
      noticeDeduction: result.noticeDeduction,
      totalDeductions: result.totalDeductions,
      netAmount: result.net,
      fgtsMonthlyBase: result.fgtsMonthlyBase,
      fgtsThirteenthBase: result.fgtsThirteenthBase,
      fgtsNoticeBase: result.fgtsNoticeBase,
      fgtsMonthlyDeposit: result.fgtsMonthlyDeposit,
      fgtsThirteenthDeposit: result.fgtsThirteenthDeposit,
      fgtsNoticeDeposit: result.fgtsNoticeDeposit,
      fgtsSeveranceDeposit: result.fgtsSeveranceDeposit,
      fgtsFine: result.fgtsFine,
      employerSocialCharges: result.employerSocialCharges,
      employerCost: result.employerCost,
      payrollHistoryCount: employeePayroll.length,
      payrollAverageSourceCount: variableHistory.length,
      competencePayrollRecordId: competencePayroll?.id || null,
      linkedEmployeeRecordId: person.id,
      rulesVersion: result.rulesVersion,
      mosVersion: result.mosVersion,
      layoutVersion: result.layoutVersion,
      esocialDeadlineBaseDate: result.esocialDeadlineBaseDate,
      paymentDeadlineBaseDate: result.paymentDeadlineBaseDate,
      esocialIndApurIR: result.esocialIndApurIR,
      esocialPaymentEvent: result.esocialPaymentEvent,
      resultHash,
      esocialStatus: "Não transmitido — prévia",
      fgtsCheckStatus: "Pendente",
      status,
      input,
      calculationLines: result.lines,
      calculationSummary: result,
      warnings: result.warnings,
      officialSources: terminationRules2026.sources,
      processedAt,
      notes:
        input.notes ||
        "Prévia rescisória para conferência do colaborador, RH e contabilidade. Nenhum dado foi transmitido a sistemas oficiais.",
    };
    const record = await createRecord(
      {
        module: "terminations",
        title: input.employeeName,
        reference: terminationCode,
        status,
        recordDate: input.terminationDate,
        amount: result.net,
        payload,
        source:
          "Motor server-side de prévia rescisória integrada",
      },
      actorFrom(request),
    );

    return Response.json(
      {
        success: true,
        record,
        input,
        result,
        integration: {
          employeeRecordId: person.id,
          payrollHistoryCount: employeePayroll.length,
          payrollAverage,
          payrollAverageSourceCount: variableHistory.length,
          competencePayrollRecordId: competencePayroll?.id || null,
          companyParameters:
            profileComplete ? "COMPANY_PROFILE" : "ESTIMATE",
          transmissions: {
            esocial: false,
            fgtsDigital: false,
            caixa: false,
            receitaFederal: false,
          },
        },
      },
      {
        status: 201,
        headers: { "cache-control": "private, no-store" },
      },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
