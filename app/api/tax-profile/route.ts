import {
  createRecord,
  listRecords,
  RecordStoreError,
  updateRecord,
} from "../../../db/records";
import {
  actorFrom,
  requireSoleAdmin,
} from "../../lib/server-access";

const allowedKeys = [
  "taxRegime",
  "cnpj",
  "legalName",
  "tradeName",
  "legalNature",
  "companySize",
  "registrationStatus",
  "primaryActivity",
  "cnae",
  "fpas",
  "thirdPartiesCode",
  "employerInssPercent",
  "thirdPartiesPercent",
  "rat",
  "fap",
] as const;

const allowedTaxRegimes = new Set([
  "Não informado",
  "Lucro Real",
  "Lucro Presumido",
  "Simples Nacional",
  "Simples Nacional — MEI",
  "Lucro Arbitrado",
]);

const clean = (value: unknown, max = 240) =>
  String(value ?? "").trim().slice(0, max);

function validateTaxProfile(profile: Record<string, string>) {
  if (!allowedTaxRegimes.has(profile.taxRegime || "Não informado")) {
    throw new RecordStoreError(
      "O regime tributário informado não é permitido.",
      "INVALID_TAX_REGIME",
    );
  }
  const cnpj = profile.cnpj.replace(/\D/g, "");
  if (cnpj && cnpj.length !== 14) {
    throw new RecordStoreError(
      "O CNPJ deve conter 14 dígitos.",
      "INVALID_CNPJ",
    );
  }
  const parameterRanges = {
    employerInssPercent: [0, 50],
    thirdPartiesPercent: [0, 20],
    rat: [0, 10],
    fap: [0.5, 2],
  } as const;
  for (const [key, [minimum, maximum]] of Object.entries(parameterRanges)) {
    const raw = profile[key];
    if (!raw) continue;
    const number = Number(raw.replace(",", "."));
    if (!Number.isFinite(number) || number < minimum || number > maximum) {
      throw new RecordStoreError(
        `O parâmetro ${key} deve ficar entre ${minimum} e ${maximum}.`,
        "INVALID_PAYROLL_PARAMETER",
      );
    }
  }
}

export async function GET() {
  try {
    const settingsRecords = await listRecords("settings");
    const current = (settingsRecords[0]?.payload || {}) as Record<string, unknown>;
    return Response.json({
      profile: Object.fromEntries(
        allowedKeys.map((key) => [key, String(current[key] ?? "")]),
      ),
    }, {
      headers: { "cache-control": "private, no-store" },
    });
  } catch {
    return Response.json({ profile: {} });
  }
}

export async function PUT(request: Request) {
  const denied = requireSoleAdmin(request);
  if (denied) return denied;

  try {
    const incoming = (await request.json()) as Record<string, unknown>;
    const settingsRecords = await listRecords("settings");
    const existing = settingsRecords[0];
    const current = (existing?.payload || {}) as Record<string, unknown>;
    const taxProfile = Object.fromEntries(
      allowedKeys.map((key) => [
        key,
        clean(incoming[key] ?? current[key] ?? ""),
      ]),
    ) as Record<string, string>;
    validateTaxProfile(taxProfile);
    const payload = { ...current, ...taxProfile };
    const record = {
      module: "settings",
      title: String(payload.systemName || "Beta Gestão 365"),
      reference: "system-config",
      status: "Ativa",
      recordDate: new Date().toISOString().slice(0, 10),
      amount: 0,
      payload,
      source: "Cadastro tributário da empresa",
    };

    const saved = existing
      ? await updateRecord(
          existing.id,
          record,
          actorFrom(request),
          typeof incoming._expectedUpdatedAt === "string"
            ? incoming._expectedUpdatedAt
            : undefined,
        )
      : await createRecord(record, actorFrom(request));
    return Response.json({ record: saved });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível salvar o enquadramento.",
        code:
          error instanceof RecordStoreError
            ? error.code
            : "TAX_PROFILE_ERROR",
      },
      { status: error instanceof RecordStoreError ? error.status : 400 },
    );
  }
}
