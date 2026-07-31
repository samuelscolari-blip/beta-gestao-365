import {
  DELETE as recordsDelete,
  GET as recordsGet,
  POST as recordsPost,
  PUT as recordsPut,
} from "../records/route";

type RecordInput = {
  module?: unknown;
  amount?: unknown;
  payload?: Record<string, unknown>;
  [key: string]: unknown;
};

const evidenceByModule: Record<string, string> = {
  expenses: "invoiceUrl",
  cards: "documentUrl",
  food: "invoiceUrl",
  asset_events: "documentUrl",
  taxes: "guideUrl",
  rentals: "contractUrl",
  purchases: "documentsUrl",
};

const partyDocumentByModule: Record<string, string> = {
  expenses: "supplierDocument",
  cards: "merchantDocument",
  food: "supplierDocument",
  rentals: "landlordDocument",
};

function hasValue(value: unknown) {
  return Boolean(String(value ?? "").trim());
}

function validateRecord(record: RecordInput) {
  const moduleId = String(record.module || "");
  const payload = record.payload || {};
  const amount = Math.max(0, Number(record.amount || 0));
  const evidenceKey = evidenceByModule[moduleId];
  const evidenceRequired =
    amount > 0 || ["rentals", "purchases"].includes(moduleId);

  if (evidenceRequired && evidenceKey && !hasValue(payload[evidenceKey])) {
    throw new Error(
      "Lançamento bloqueado: vincule nota fiscal, cupom fiscal, recibo, guia, cotação ou contrato obrigatório.",
    );
  }

  const partyKey = partyDocumentByModule[moduleId];
  if (amount > 0 && partyKey && !hasValue(payload[partyKey])) {
    throw new Error(
      "Lançamento bloqueado: informe o CPF ou CNPJ do fornecedor, estabelecimento ou locador.",
    );
  }
}

function securedUrl(request: Request) {
  const url = new URL(request.url);
  url.pathname = url.pathname.replace(/\/api\/records-v52$/, "/api/records");
  return url;
}

function forwardRequest(request: Request, body?: unknown) {
  const headers = new Headers(request.headers);
  headers.delete("content-length");
  if (body !== undefined) {
    headers.set("content-type", "application/json; charset=utf-8");
  }
  return new Request(securedUrl(request), {
    method: request.method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function validationError(error: unknown) {
  return Response.json(
    {
      error:
        error instanceof Error
          ? error.message
          : "O lançamento não atende às regras documentais.",
      code: "DOCUMENT_EVIDENCE_REQUIRED",
    },
    { status: 400 },
  );
}

export async function GET(request: Request) {
  return recordsGet(forwardRequest(request));
}

export async function POST(request: Request) {
  try {
    const body = (await request.clone().json()) as {
      record?: RecordInput;
      records?: RecordInput[];
      [key: string]: unknown;
    };
    if (Array.isArray(body.records)) {
      body.records.forEach(validateRecord);
    } else {
      validateRecord(body.record || body);
    }
    return recordsPost(forwardRequest(request, body));
  } catch (error) {
    return validationError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.clone().json()) as {
      record?: RecordInput;
      [key: string]: unknown;
    };
    validateRecord(body.record || body);
    return recordsPut(forwardRequest(request, body));
  } catch (error) {
    return validationError(error);
  }
}

export async function DELETE(request: Request) {
  return recordsDelete(forwardRequest(request));
}
