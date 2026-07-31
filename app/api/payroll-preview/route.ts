import {
  calculatePayroll,
  normalizePayrollInput,
  validatePayrollInput,
  type PayrollAdditionalType,
  type PayrollInput,
  type PayrollResult,
} from "../../lib/payroll";
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

class PayrollApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "PayrollApiError";
  }
}

type CompanyPayrollParameters = {
  employerInssPercent?: unknown;
  rat?: unknown;
  fap?: unknown;
  thirdPartiesPercent?: unknown;
};

type BatchEmployee = {
  id?: unknown;
  nome?: unknown;
  name?: unknown;
  cargo?: unknown;
  role?: unknown;
  obraId?: unknown;
  obra?: unknown;
  workName?: unknown;
  salarioBase?: unknown;
  baseSalary?: unknown;
  horasExtrasHoras?: unknown;
  overtimeHours?: unknown;
  tipoAdicional?: unknown;
  additionalType?: unknown;
  grauInsalubridade?: unknown;
  insalubrityDegree?: unknown;
  salarioMinimoVigente?: unknown;
  insalubrityBase?: unknown;
  dependentesIRRF?: unknown;
  dependents?: unknown;
  contractType?: unknown;
};

type RegisteredBatchRequest = {
  competencia?: unknown;
  obra?: unknown;
};

const money = (value: number) =>
  Math.round(
    ((Number.isFinite(value) ? value : 0) + 1e-9) * 100,
  ) / 100;

const profileNumber = (value: unknown) => {
  const normalized = String(value ?? "").trim().replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

function resolveAdditionalType(value: unknown): PayrollAdditionalType {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (["INSALUBRITY", "INSALUBRIDADE"].includes(normalized)) {
    return "INSALUBRITY";
  }
  if (["HAZARD", "PERICULOSIDADE"].includes(normalized)) return "HAZARD";
  return "NONE";
}

function applyCompanyParameters(
  input: PayrollInput,
  profile: CompanyPayrollParameters,
) {
  const employerInssPercent = profileNumber(profile.employerInssPercent);
  const ratPercent = profileNumber(profile.rat);
  const fapFactor = profileNumber(profile.fap);
  const thirdPartiesPercent = profileNumber(profile.thirdPartiesPercent);
  const profileComplete = [
    employerInssPercent,
    ratPercent,
    fapFactor,
    thirdPartiesPercent,
  ].every((value) => value !== null);

  return normalizePayrollInput({
    ...input,
    employerInssPercent:
      employerInssPercent ?? input.employerInssPercent,
    ratPercent: ratPercent ?? input.ratPercent,
    fapFactor: fapFactor ?? input.fapFactor,
    thirdPartiesPercent:
      thirdPartiesPercent ?? input.thirdPartiesPercent,
    employerParameterSource: profileComplete
      ? "COMPANY_PROFILE"
      : "ESTIMATE",
  });
}

async function companyProfile() {
  const settings = await listRecords("settings");
  return (settings[0]?.payload || {}) as CompanyPayrollParameters;
}

function assertValid(input: PayrollInput) {
  const errors = validatePayrollInput(input);
  if (errors.length) {
    throw new PayrollApiError(
      errors.join(" "),
      "INVALID_PAYROLL_INPUT",
    );
  }
}

function batchInput(
  employee: BatchEmployee,
  competence: string,
  workId: string,
  company: CompanyPayrollParameters,
) {
  const contractType = String(employee.contractType ?? "");
  const input = normalizePayrollInput({
    employeeName: String(employee.nome ?? employee.name ?? ""),
    employeeCode: String(employee.id ?? ""),
    role: String(employee.cargo ?? employee.role ?? ""),
    workName: String(
      workId ||
        employee.obraId ||
        employee.obra ||
        employee.workName ||
        "",
    ),
    competence,
    baseSalary: Number(employee.salarioBase ?? employee.baseSalary ?? 0),
    monthlyHours: 220,
    overtimeHours: Number(
      employee.horasExtrasHoras ?? employee.overtimeHours ?? 0,
    ),
    overtimePercent: 50,
    additionalType: resolveAdditionalType(
      employee.tipoAdicional ?? employee.additionalType,
    ),
    insalubrityDegree: Number(
      employee.grauInsalubridade ?? employee.insalubrityDegree ?? 20,
    ) as 10 | 20 | 40,
    insalubrityBase: Number(
      employee.salarioMinimoVigente ??
        employee.insalubrityBase ??
        1621,
    ),
    taxableAdditions: 0,
    nonTaxableEarnings: 0,
    dependents: Number(
      employee.dependentesIRRF ?? employee.dependents ?? 0,
    ),
    pensionDeduction: 0,
    salaryAdvance: 0,
    consignments: 0,
    unionContribution: 0,
    otherDeductions: 0,
    fgtsCategory: /aprendiz/i.test(contractType)
      ? "APPRENTICE"
      : "STANDARD",
    employerInssPercent: 20,
    ratPercent: 2,
    fapFactor: 1,
    thirdPartiesPercent: 5.8,
    employerParameterSource: "ESTIMATE",
  });
  return applyCompanyParameters(input, company);
}

function aggregate(results: PayrollResult[]) {
  return results.reduce(
    (totals, result) => ({
      totalBruto: money(totals.totalBruto + result.gross),
      totalLiquido: money(totals.totalLiquido + result.net),
      totalINSS: money(totals.totalINSS + result.inss),
      totalIRRF: money(totals.totalIRRF + result.irrf),
      totalFGTS: money(totals.totalFGTS + result.fgts),
      totalEncargosPatronais: money(
        totals.totalEncargosPatronais + result.employerCharges,
      ),
      custoEmpresarialTotal: money(
        totals.custoEmpresarialTotal + result.totalEmployerCost,
      ),
    }),
    {
      totalBruto: 0,
      totalLiquido: 0,
      totalINSS: 0,
      totalIRRF: 0,
      totalFGTS: 0,
      totalEncargosPatronais: 0,
      custoEmpresarialTotal: 0,
    },
  );
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
    error instanceof PayrollApiError
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
          : "Erro interno ao processar o cálculo da folha.",
      code:
        error instanceof PayrollApiError
          ? error.code
          : error instanceof RecordStoreError
            ? error.code
            : "PAYROLL_PROCESSING_ERROR",
    },
    { status },
  );
}

export async function POST(request: Request) {
  const denied = requireSoleAdmin(request);
  if (denied) return denied;

  try {
    const body = (await request.json()) as {
      input?: Partial<PayrollInput>;
      competencia?: string;
      obraId?: string;
      colaboradoresList?: BatchEmployee[];
      registeredBatch?: RegisteredBatchRequest;
    };
    const profile = await companyProfile();

    const registeredBatch = body.registeredBatch;
    let batchEmployees = Array.isArray(body.colaboradoresList)
      ? body.colaboradoresList
      : null;
    let batchCompetence = body.competencia;
    let batchWork = String(body.obraId ?? "");

    if (registeredBatch) {
      batchCompetence = String(registeredBatch.competencia ?? "");
      batchWork = String(registeredBatch.obra ?? "").trim();
      const registeredPeople = await listRecords("people");
      batchEmployees = registeredPeople
        .filter(
          (person) =>
            person.status.toLowerCase() === "ativo" &&
            (!batchWork ||
              String(person.payload.work ?? "").trim() === batchWork),
        )
        .map((person) => ({
          id: person.id,
          nome: person.payload.name || person.title,
          cargo: person.payload.role,
          obraId: person.payload.work,
          salarioBase: person.payload.salary,
          dependentesIRRF: person.payload.dependents,
          contractType: person.payload.contractType,
        }));
    }

    if (batchEmployees) {
      if (!batchCompetence || batchEmployees.length === 0) {
        throw new PayrollApiError(
          "Informe a competência e ao menos um colaborador para o cálculo em lote.",
          "INVALID_BATCH_INPUT",
        );
      }
      if (batchEmployees.length > 500) {
        throw new PayrollApiError(
          "O cálculo em lote aceita no máximo 500 colaboradores por requisição.",
          "BATCH_LIMIT_EXCEEDED",
          413,
        );
      }

      const details = batchEmployees.map((employee, index) => {
        const input = batchInput(
          employee,
          batchCompetence!,
          batchWork,
          profile,
        );
        const errors = validatePayrollInput(input);
        if (errors.length) {
          throw new PayrollApiError(
            `Colaborador ${index + 1}: ${errors.join(" ")}`,
            "INVALID_BATCH_EMPLOYEE",
          );
        }
        return {
          colaboradorId: String(employee.id ?? ""),
          nome: input.employeeName,
          cargo: input.role,
          obraId: input.workName,
          input,
          resultado: calculatePayroll(input),
        };
      });
      const meta = {
        competencia: normalizePayrollInput({
          competence: batchCompetence,
        }).competence,
        dataProcessamento: new Date().toISOString(),
        quantidadeColaboradores: details.length,
        rulesVersion: details[0]?.resultado.rulesVersion,
        fonte: registeredBatch
          ? "Cadastro de Funcionários persistente"
          : "Lista administrativa informada",
      };
      const totals = aggregate(details.map((detail) => detail.resultado));
      let batchRecord: StoredRecord | undefined;

      if (registeredBatch) {
        const batchCode = `LOTE-${meta.competencia
          .slice(0, 7)
          .replace("-", "")}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
        const resultHash = await sha256Json({
          meta,
          totals,
          details: details.map((detail) => ({
            colaboradorId: detail.colaboradorId,
            input: detail.input,
            resultado: detail.resultado,
          })),
        });
        batchRecord = await createRecord(
          {
            module: "payroll",
            title: `Lote ${meta.competencia.slice(0, 7)}${batchWork ? ` • ${batchWork}` : ""}`,
            reference: batchCode,
            status: "Em conferência",
            recordDate: meta.competencia,
            amount: totals.totalLiquido,
            payload: {
              previewCode: batchCode,
              recordType: "BATCH",
              competence: meta.competencia,
              employeeName: "Processamento em lote",
              workName: batchWork || "Todas as obras",
              grossAmount: totals.totalBruto,
              netAmount: totals.totalLiquido,
              employerCost: totals.custoEmpresarialTotal,
              employerCharges: totals.totalEncargosPatronais,
              inss: totals.totalINSS,
              irrf: totals.totalIRRF,
              fgts: totals.totalFGTS,
              rulesVersion: meta.rulesVersion,
              employeeCount: details.length,
              employeeIds: details.map((detail) => detail.colaboradorId),
              resultHash,
              status: "Em conferência",
              processedAt: meta.dataProcessamento,
              notes:
                "Lote administrativo calculado no servidor a partir do Cadastro de Funcionários. O hash preserva a conferência do resultado integral desta execução.",
            },
            source: "Motor server-side de folha em lote",
          },
          actorFrom(request),
        );
      }

      return Response.json({
        success: true,
        meta,
        totais: totals,
        detalhes: details,
        record: batchRecord,
      }, {
        status: batchRecord ? 201 : 200,
        headers: { "cache-control": "private, no-store" },
      });
    }

    const input = applyCompanyParameters(
      normalizePayrollInput(body.input || {}),
      profile,
    );
    assertValid(input);
    const result = calculatePayroll(input);
    const previewCode = `FOL-${input.competence
      .slice(0, 7)
      .replace("-", "")}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const payload = {
      previewCode,
      competence: input.competence,
      employeeName: input.employeeName,
      employeeCode: input.employeeCode,
      role: input.role,
      workName: input.workName,
      additionalType: input.additionalType,
      additionalAmount: result.additionalAmount,
      grossAmount: result.gross,
      inss: result.inss,
      irrf: result.irrf,
      fgts: result.fgts,
      netAmount: result.net,
      employerCost: result.totalEmployerCost,
      employerCharges: result.employerCharges,
      rulesVersion: result.rulesVersion,
      parameterSource: input.employerParameterSource,
      status: "Prévia",
      input,
      calculationLines: result.lines,
      calculationSummary: result,
      warnings: result.warnings,
      processedAt: new Date().toISOString(),
      notes:
        "Cálculo administrativo para conferência contábil. Não representa fechamento oficial.",
    };
    const record = await createRecord(
      {
        module: "payroll",
        title: input.employeeName,
        reference: previewCode,
        status: "Prévia",
        recordDate: input.competence,
        amount: result.net,
        payload,
        source: "Motor server-side de Cálculo de Folha",
      },
      actorFrom(request),
    );

    return Response.json(
      {
        success: true,
        record: record as StoredRecord,
        input,
        result,
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
