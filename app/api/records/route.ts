import {
  baseOficialAtiva,
  createMany,
  createRecord,
  deleteRecord,
  ensureDemoRecords,
  listImportRuns,
  listAuditLogs,
  listRecords,
  queryRecords,
  RecordStoreError,
  resolveImportError,
  saveImportReport,
  updateRecord,
} from "../../../db/records";
import {
  actorFrom,
  isSoleAdmin,
  requireSoleAdmin,
} from "../../lib/server-access";
import { moduleMap } from "../../lib/modules";

function errorResponse(error: unknown) {
  const message =
    error instanceof Error ? error.message : "Não foi possível concluir a ação.";
  const status = error instanceof RecordStoreError ? error.status : 400;
  return Response.json(
    {
      error: message,
      code: error instanceof RecordStoreError ? error.code : "REQUEST_ERROR",
    },
    { status },
  );
}

function redactAdminIdentity(value: unknown): unknown {
  if (typeof value === "string") {
    return value
      .replace(/scolarisamuel@gmail\.com/gi, "administrador protegido")
      .replace(/samuel\s+scolari/gi, "Administrador do sistema");
  }
  if (Array.isArray(value)) return value.map(redactAdminIdentity);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        redactAdminIdentity(item),
      ]),
    );
  }
  return value;
}

const protectedPeopleFields = new Set([
  "cpf",
  "cpfVerificationStatus",
  "cpfVerificationDate",
  "cpfProofUrl",
  "pis",
  "rgNumber",
  "voterNumber",
  "ctpsNumber",
  "cnhNumber",
  "cns",
  "passportNumber",
  "personalEmail",
  "phone",
  "emergencyContact",
  "address",
  "addressNumber",
  "addressComplement",
  "postalCode",
  "bank",
  "agency",
  "account",
  "pix",
  "bankData",
  "dependentDetails",
]);

function requiredWriteField(
  payload: Record<string, unknown>,
  key: string,
  message: string,
) {
  if (!String(payload[key] || "").trim()) {
    throw new Error(message);
  }
}

function firstNonBlank(...values: unknown[]) {
  return (
    values.find((value) => String(value ?? "").trim() !== "") ?? ""
  );
}

function applyCanonicalAliases(
  moduleId: string,
  payload: Record<string, unknown>,
) {
  if (moduleId === "expenses") {
    payload.supplierCode = firstNonBlank(
      payload.supplierDocument,
      payload.supplierCode,
    );
  } else if (moduleId === "cards") {
    payload.holder = firstNonBlank(payload.cardName, payload.holder);
    payload.cardEnding = firstNonBlank(
      payload.merchantDocument,
      payload.cardEnding,
    );
  } else if (moduleId === "food") {
    payload.supplierCode = firstNonBlank(
      payload.supplierDocument,
      payload.supplierCode,
    );
  }
}

function normalizeRecordForWrite(input: Record<string, unknown>) {
  const moduleId = String(input.module || "").trim();
  const payload = {
    ...((input.payload && typeof input.payload === "object" && !Array.isArray(input.payload)
      ? input.payload
      : {}) as Record<string, unknown>),
  };
  applyCanonicalAliases(moduleId, payload);

  const amount = Math.max(0, Number(input.amount || 0));
  const next: Record<string, unknown> = { ...input, payload };

  if (moduleId === "expenses") {
    if (amount > 0) {
      requiredWriteField(
        payload,
        "invoiceUrl",
        "Lançamento bloqueado: anexe a nota fiscal, o cupom fiscal ou o recibo.",
      );
      requiredWriteField(
        payload,
        "supplierCode",
        "Lançamento bloqueado: informe o CPF ou CNPJ do fornecedor ou estabelecimento.",
      );
    }
  }

  if (moduleId === "cards" && amount > 0) {
    requiredWriteField(
      payload,
      "documentUrl",
      "Despesa de cartão bloqueada: anexe a nota fiscal, o cupom fiscal ou o recibo.",
    );
    requiredWriteField(
      payload,
      "cardEnding",
      "Despesa de cartão bloqueada: informe o CPF ou CNPJ do estabelecimento.",
    );
  }

  if (moduleId === "food" && amount > 0) {
    requiredWriteField(
      payload,
      "invoiceUrl",
      "Lançamento de alimentação bloqueado: anexe o documento fiscal.",
    );
    requiredWriteField(
      payload,
      "supplierCode",
      "Lançamento de alimentação bloqueado: informe o CPF ou CNPJ do fornecedor.",
    );
  }

  if (moduleId === "rentals") {
    requiredWriteField(
      payload,
      "contractUrl",
      "Cadastro de aluguel bloqueado: vincule o documento e o contrato.",
    );
    requiredWriteField(
      payload,
      "landlordDocument",
      "Cadastro de aluguel bloqueado: informe o CPF ou CNPJ do locador.",
    );
  }

  return next;
}

/*
 * O que deixa de aparecer quando a base é declarada real.
 *
 * Nome e salário estavam abertos a quem só abrisse o endereço do site. Com
 * "Colaborador Teste 01" isso não custava nada. Com o eletricista da obra,
 * custa duas coisas: é dado pessoal exposto a qualquer um com o link, e é
 * justamente o dado que mais gera atrito dentro da equipe — cada um
 * descobrindo quanto o outro ganha.
 *
 * Cargo e situação continuam visíveis: são o que faz a tela ter serventia
 * para engenheiro e encarregado, que precisam saber quem está ativo e em que
 * função, e nunca precisaram saber o salário.
 */
const camposPessoaisDaBaseReal = new Set(["name", "salary"]);

function publicPayload(
  moduleId: string,
  payload: Record<string, unknown>,
  baseOficial: boolean,
) {
  const redacted = redactAdminIdentity(payload) as Record<string, unknown>;
  if (moduleId === "payroll") {
    return {
      previewCode: "Dado protegido",
      competence: redacted.competence || "",
      employeeName: "Dado protegido",
      employeeCode: "Dado protegido",
      rulesVersion: redacted.rulesVersion || "",
      status: redacted.status || "Prévia",
      notes:
        "A memória de cálculo individual é exibida somente ao administrador.",
    };
  }
  if (moduleId === "terminations") {
    return {
      terminationCode: "Dado protegido",
      employeeName: "Dado protegido",
      employeeCode: "Dado protegido",
      terminationDate: redacted.terminationDate || "",
      projectedTerminationDate: redacted.projectedTerminationDate || "",
      terminationTypeLabel:
        redacted.terminationTypeLabel || "Desligamento",
      esocialReasonCode: redacted.esocialReasonCode || "",
      rulesVersion: redacted.rulesVersion || "",
      mosVersion: redacted.mosVersion || "",
      layoutVersion: redacted.layoutVersion || "",
      esocialDeadlineBaseDate:
        redacted.esocialDeadlineBaseDate || "",
      paymentDeadlineBaseDate:
        redacted.paymentDeadlineBaseDate || "",
      esocialStatus: redacted.esocialStatus || "Não preparado",
      fgtsCheckStatus: redacted.fgtsCheckStatus || "Pendente",
      status: redacted.status || "Em conferência",
      notes:
        "Identidade, valores e memória da rescisão são exibidos somente ao administrador.",
    };
  }
  if (moduleId === "compliance") {
    return {
      eventId: "Dado protegido",
      eventName: redacted.eventName || "Evento fiscal",
      system: redacted.system || "",
      eventCode: redacted.eventCode || "",
      eventGroup: redacted.eventGroup || "",
      competence: redacted.competence || "",
      environment: redacted.environment || "",
      layoutVersion: redacted.layoutVersion || "",
      validationStatus: redacted.validationStatus || "",
      certificateType: redacted.certificateType || "Não configurado",
      status: redacted.status || "Rascunho",
      notes:
        "Protocolos, recibos, XMLs, CNPJ e responsáveis são visíveis somente ao administrador.",
      };
  }
  if (moduleId === "worklogs") {
    return {
      ...redacted,
      absentOperator: redacted.absentOperator ? "Dado protegido" : "",
      responsible: "",
      notes: "",
    };
  }
  if (moduleId !== "people") return redacted;
  return Object.fromEntries(
    Object.entries(redacted).map(([key, value]) => [
      key,
      (protectedPeopleFields.has(key) ||
        (baseOficial && camposPessoaisDaBaseReal.has(key))) &&
      String(value ?? "").trim()
        ? "Dado protegido"
        : value,
    ]),
  );
}

function toPublicRecord<
  T extends {
    module: string;
    title: string;
    reference: string;
    amount: number;
    createdBy: string;
    payload: Record<string, unknown>;
  },
>(
  record: T,
  baseOficial: boolean,
) {
  const isPayroll = record.module === "payroll";
  const isTermination = record.module === "terminations";
  const isProtectedCalculation = isPayroll || isTermination;
  /*
   * O título do cadastro de funcionário É o nome, e o valor É o salário.
   * Proteger só o payload deixaria os dois passando pela porta da frente.
   */
  const pessoaProtegida = baseOficial && record.module === "people";
  return {
    ...record,
    title: isPayroll
      ? "Cálculo protegido"
      : isTermination
        ? "Rescisão protegida"
        : pessoaProtegida
          ? "Dado protegido"
          : record.title,
    reference: isProtectedCalculation
      ? "Dado protegido"
      : record.reference,
    amount: isProtectedCalculation || pessoaProtegida ? 0 : record.amount,
    createdBy: "",
    payload: publicPayload(record.module, record.payload, baseOficial),
  };
}

export async function GET(request: Request) {
  try {
    /*
     * A semeadura dos exemplos NÃO pode derrubar a leitura.
     *
     * Ela rodava dentro do mesmo `try` da consulta, e o que aconteceu foi
     * isto: um registro fictício de treinamento passou a ser recusado por
     * "Módulo inválido", a recusa derrubou a semeadura inteira, a resposta
     * virou erro — e o sistema TODO ficou vazio. Obras, máquinas, contas,
     * pessoas: tudo sumiu da tela por causa de um exemplo.
     *
     * Exemplo é conforto, dado real é o serviço. Se o conforto falhar, o
     * serviço continua: a falha vai para o log e a consulta segue.
     */
    try {
      await ensureDemoRecords();
    } catch (error) {
      console.error(
        "Falha ao semear os registros de exemplo. A consulta segue com os dados reais.",
        error,
      );
    }
    const url = new URL(request.url);
    if (url.searchParams.get("view") === "imports") {
      if (!isSoleAdmin(request)) {
        return Response.json({ error: "Acesso restrito." }, { status: 403 });
      }
      return Response.json(
        { imports: await listImportRuns() },
        { headers: { "cache-control": "private, no-store" } },
      );
    }
    if (url.searchParams.get("view") === "audit") {
      if (!isSoleAdmin(request)) {
        return Response.json({ error: "Acesso restrito." }, { status: 403 });
      }
      const recordIdValue = Number(url.searchParams.get("recordId"));
      const moduleFilter = url.searchParams.get("module") || undefined;
      return Response.json({
        audit: await listAuditLogs({
          recordId: Number.isInteger(recordIdValue) && recordIdValue > 0
            ? recordIdValue
            : undefined,
          module: moduleFilter,
        }),
      }, {
        headers: { "cache-control": "private, no-store" },
      });
    }
    if (
      url.searchParams.get("module") === "settings" &&
      !isSoleAdmin(request)
    ) {
      return Response.json({ error: "Acesso restrito." }, { status: 403 });
    }
    const moduleId = url.searchParams.get("module");
    const isKnownModule = !moduleId || Boolean(moduleMap[moduleId]);
    const paginated = ["page", "pageSize", "search", "status"].some((key) =>
      url.searchParams.has(key),
    );
    const queryResult = paginated && isKnownModule
      ? await queryRecords({
          module: moduleId,
          search: url.searchParams.get("search"),
          status: url.searchParams.get("status"),
          page: Number(url.searchParams.get("page") || 1),
          pageSize: Number(url.searchParams.get("pageSize") || 50),
          excludeSettings: !isSoleAdmin(request),
        })
      : null;
    const records = (
      isKnownModule ? queryResult?.records || await listRecords(moduleId) : []
    ).filter((record) => Boolean(moduleMap[record.module]));
    const publicRecords = isSoleAdmin(request)
      ? records
      : await (async () => {
          const baseOficial = await baseOficialAtiva();
          return records
            .filter((record) => record.module !== "settings")
            .map((record) => toPublicRecord(record, baseOficial));
        })();
    return Response.json({
      records: publicRecords,
      ...(queryResult
        ? {
            pagination: {
              page: queryResult.page,
              pageSize: queryResult.pageSize,
              total: queryResult.total,
              totalPages: queryResult.totalPages,
            },
          }
        : {}),
    }, {
      headers: { "cache-control": "private, no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  const denied = requireSoleAdmin(request);
  if (denied) return denied;

  try {
    const payload = (await request.json()) as {
      records?: Array<Record<string, unknown>>;
      record?: Record<string, unknown>;
      importReport?: Record<string, unknown>;
    };
    if (payload.importReport) {
      return Response.json(
        {
          importReport: await saveImportReport(
            payload.importReport,
            actorFrom(request),
          ),
        },
        { status: 201 },
      );
    }
    if (Array.isArray(payload.records)) {
      const validRecords: Array<Record<string, unknown>> = [];
      const originalIndexes: number[] = [];
      const rejected: Array<{
        index: number;
        reason: string;
        payload: Record<string, unknown>;
      }> = [];
      payload.records.forEach((record, index) => {
        try {
          validRecords.push(normalizeRecordForWrite(record));
          originalIndexes.push(index);
        } catch (error) {
          rejected.push({
            index,
            reason:
              error instanceof Error
                ? error.message
                : "A linha foi rejeitada pelas regras documentais.",
            payload: record,
          });
        }
      });
      const imported = await createMany(validRecords, actorFrom(request));
      const serverFailures = imported.failures.map((failure) => ({
        ...failure,
        index: originalIndexes[failure.index] ?? failure.index,
      }));
      return Response.json(
        {
          result: {
            ...imported,
            failures: [...rejected, ...serverFailures].sort(
              (left, right) => left.index - right.index,
            ),
          },
        },
        { status: 201 },
      );
    }
    return Response.json(
      {
        record: await createRecord(
          normalizeRecordForWrite(payload.record || payload),
          actorFrom(request),
        ),
      },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request) {
  const denied = requireSoleAdmin(request);
  if (denied) return denied;

  try {
    const payload = (await request.json()) as {
      id?: number;
      record?: Record<string, unknown>;
      expectedUpdatedAt?: string;
      resolveImportErrorId?: string;
    };
    if (payload.resolveImportErrorId) {
      return Response.json({
        importError: await resolveImportError(
          payload.resolveImportErrorId,
          actorFrom(request),
        ),
      });
    }
    if (!payload.id) {
      return Response.json({ error: "ID obrigatório." }, { status: 400 });
    }
    return Response.json({
      record: await updateRecord(
        payload.id,
        normalizeRecordForWrite(payload.record || payload),
        actorFrom(request),
        payload.expectedUpdatedAt,
      ),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  const denied = requireSoleAdmin(request);
  if (denied) return denied;

  try {
    const url = new URL(request.url);
    const id = Number(url.searchParams.get("id"));
    if (!id) {
      return Response.json({ error: "ID obrigatório." }, { status: 400 });
    }
    return Response.json({ result: await deleteRecord(id, actorFrom(request)) });
  } catch (error) {
    return errorResponse(error);
  }
}
