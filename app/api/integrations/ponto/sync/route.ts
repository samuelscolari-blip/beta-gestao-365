import { listRecords } from "../../../../../db/records";
import { requireSoleAdmin } from "../../../../lib/server-access";

const DEFAULT_POINT_BASE_URL =
  "https://beta-ponto-eletronico-365.scolarisamuel.workers.dev";

type PointRole =
  | "OPERATOR"
  | "CHIEF_ENGINEER"
  | "EMPLOYEE_SELF_SERVICE";

function pointRole(jobTitle: unknown): PointRole {
  const role = String(jobTitle || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
  if (role.includes("ENCARREG")) return "OPERATOR";
  if (role.includes("ENGENHEIRO")) return "CHIEF_ENGINEER";
  return "EMPLOYEE_SELF_SERVICE";
}

function employmentStatus(status: unknown) {
  const normalized = String(status || "").toLowerCase();
  if (normalized.includes("deslig")) return "TERMINATED" as const;
  if (normalized.includes("afast") || normalized.includes("ferias") || normalized.includes("férias")) {
    return "ON_LEAVE" as const;
  }
  return "ACTIVE" as const;
}

function scheduleLabel(payload: Record<string, unknown>) {
  return String(
    payload.weeklySchedule ||
      payload.journeyType ||
      (payload.monthlyHours ? `${payload.monthlyHours} horas mensais` : ""),
  ).trim();
}

function normalize(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

async function integrationConfig() {
  const { env } = await import("cloudflare:workers");
  const runtime = env as unknown as {
    GESTAO_365_SYNC_TOKEN?: string;
    BETA_PONTO_BASE_URL?: string;
  };
  return {
    token: String(runtime.GESTAO_365_SYNC_TOKEN || "").trim(),
    baseUrl: String(runtime.BETA_PONTO_BASE_URL || DEFAULT_POINT_BASE_URL)
      .trim()
      .replace(/\/+$/, ""),
  };
}

export async function POST(request: Request) {
  const denied = requireSoleAdmin(request);
  if (denied) return denied;

  const { token, baseUrl } = await integrationConfig();
  if (!token) {
    return Response.json(
      {
        ok: false,
        error: "POINT_SYNC_NOT_CONFIGURED",
        message:
          "A integração com o Beta Ponto ainda não possui GESTAO_365_SYNC_TOKEN configurado.",
      },
      { status: 503 },
    );
  }

  const [people, works] = await Promise.all([
    listRecords("people"),
    listRecords("works"),
  ]);

  const workByName = new Map(
    works.map((record) => [normalize(record.payload.name || record.title), record]),
  );

  const payload = people.map((record) => {
    const person = record.payload;
    const workName = String(person.work || "").trim();
    const workRecord = workByName.get(normalize(workName));
    const employeeNumber = String(
      person.registration || person.employeeCode || record.reference,
    ).trim();

    return {
      sourceRecordId: `beta-gestao-365:people:${record.id}`,
      employeeNumber,
      fullName: String(person.name || record.title).trim(),
      jobTitle: String(person.role || "").trim() || null,
      scheduleLabel: scheduleLabel(person) || null,
      employmentStatus: employmentStatus(record.status || person.status),
      role: pointRole(person.role),
      worksite: workName
        ? {
            sourceRecordId: workRecord
              ? `beta-gestao-365:works:${workRecord.id}`
              : `beta-gestao-365:work-name:${normalize(workName)}`,
            code: String(workRecord?.payload.code || workRecord?.reference || workName)
              .trim()
              .slice(0, 60),
            name: workName,
            status:
              workRecord && String(workRecord.status).toLowerCase().includes("concl")
                ? "COMPLETED"
                : workRecord && String(workRecord.status).toLowerCase().includes("paus")
                  ? "INACTIVE"
                  : "ACTIVE",
          }
        : null,
    };
  });

  if (!payload.length) {
    return Response.json(
      {
        ok: false,
        error: "NO_EMPLOYEES",
        message: "Nenhum funcionário oficial foi encontrado para sincronizar.",
      },
      { status: 409 },
    );
  }

  const headers = {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
  };

  const validationResponse = await fetch(
    `${baseUrl}/api/integrations/people/validate`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ people: payload }),
    },
  );
  const validation = (await validationResponse.json()) as Record<string, unknown>;
  if (!validationResponse.ok || validation.ok !== true) {
    return Response.json(
      {
        ok: false,
        stage: "validate",
        message: "O Beta Ponto recusou a validação do quadro de funcionários.",
        point: validation,
      },
      { status: 422 },
    );
  }

  const syncResponse = await fetch(`${baseUrl}/api/integrations/people/sync`, {
    method: "POST",
    headers,
    body: JSON.stringify({ origin: "BETA_GESTAO_365", people: payload }),
  });
  const synced = (await syncResponse.json()) as Record<string, unknown>;
  if (!syncResponse.ok || synced.ok !== true) {
    return Response.json(
      {
        ok: false,
        stage: "sync",
        message: "O Beta Ponto não concluiu a sincronização.",
        point: synced,
      },
      { status: 502 },
    );
  }

  return Response.json(
    {
      ok: true,
      total: payload.length,
      worksite: Array.from(new Set(payload.map((item) => item.worksite?.name).filter(Boolean))),
      created: synced.created || 0,
      updated: synced.updated || 0,
      semAcesso: synced.semAcesso || [],
      message: `${payload.length} funcionários enviados ao Beta Ponto sem documentos pessoais.`,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
