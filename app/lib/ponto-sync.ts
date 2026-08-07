import { listRecords } from "../../db/records";

const DEFAULT_POINT_BASE_URL =
  "https://beta-ponto-eletronico-365.scolarisamuel.workers.dev";

type PointRole =
  | "OPERATOR"
  | "CHIEF_ENGINEER"
  | "EMPLOYEE_SELF_SERVICE";

type PointSyncResponse = {
  ok?: boolean;
  created?: number;
  updated?: number;
  deactivated?: number;
  semAcesso?: string[];
  message?: string;
  [key: string]: unknown;
};

export type PointSyncResult = {
  ok: true;
  total: number;
  worksites: string[];
  created: number;
  updated: number;
  deactivated: number;
  semAcesso: string[];
  environmentMode: "REAL";
};

export class PointSyncError extends Error {
  constructor(
    message: string,
    public readonly stage:
      | "configuration"
      | "source"
      | "validate"
      | "sync"
      | "environment",
    public readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "PointSyncError";
  }
}

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
  if (
    normalized.includes("afast") ||
    normalized.includes("ferias") ||
    normalized.includes("férias")
  ) {
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

async function json(response: Response): Promise<Record<string, unknown>> {
  return (await response.json().catch(() => ({}))) as Record<string, unknown>;
}

/*
 * Uma única rotina para botão manual e sincronização automática.
 *
 * A ordem é deliberada: primeiro valida, depois envia o retrato completo das
 * pessoas, e só então reafirma que o ambiente do Ponto é REAL. Assim o Ponto
 * nunca troca de base antes de conhecer o quadro oficial que deverá exibir.
 */
export async function syncOfficialDirectoryToPoint(): Promise<PointSyncResult> {
  const { token, baseUrl } = await integrationConfig();
  if (!token) {
    throw new PointSyncError(
      "A integração com o Beta Ponto ainda não possui GESTAO_365_SYNC_TOKEN configurado.",
      "configuration",
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
            code: String(
              workRecord?.payload.code || workRecord?.reference || workName,
            )
              .trim()
              .slice(0, 60),
            name: workName,
            status:
              workRecord &&
              String(workRecord.status).toLowerCase().includes("concl")
                ? "COMPLETED"
                : workRecord &&
                    String(workRecord.status).toLowerCase().includes("paus")
                  ? "INACTIVE"
                  : "ACTIVE",
          }
        : null,
    };
  });

  if (!payload.length) {
    throw new PointSyncError(
      "Nenhum funcionário oficial foi encontrado para sincronizar.",
      "source",
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
  const validation = await json(validationResponse);
  if (!validationResponse.ok || validation.ok !== true) {
    throw new PointSyncError(
      "O Beta Ponto recusou a validação do quadro de funcionários.",
      "validate",
      validation,
    );
  }

  const syncResponse = await fetch(`${baseUrl}/api/integrations/people/sync`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      origin: "BETA_GESTAO_365",
      fullSnapshot: true,
      people: payload,
    }),
  });
  const synced = (await json(syncResponse)) as PointSyncResponse;
  if (!syncResponse.ok || synced.ok !== true) {
    throw new PointSyncError(
      "O Beta Ponto não concluiu a sincronização do cadastro.",
      "sync",
      synced,
    );
  }

  const modeResponse = await fetch(
    `${baseUrl}/api/integrations/environment/mode`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        mode: "REAL",
        decidedAt: new Date().toISOString(),
      }),
    },
  );
  const mode = await json(modeResponse);
  if (!modeResponse.ok || mode.ok !== true) {
    throw new PointSyncError(
      "O cadastro foi sincronizado, mas o Beta Ponto não confirmou a BASE REAL.",
      "environment",
      mode,
    );
  }

  return {
    ok: true,
    total: payload.length,
    worksites: Array.from(
      new Set(payload.map((item) => item.worksite?.name).filter(Boolean)),
    ) as string[],
    created: Number(synced.created || 0),
    updated: Number(synced.updated || 0),
    deactivated: Number(synced.deactivated || 0),
    semAcesso: Array.isArray(synced.semAcesso)
      ? synced.semAcesso.map(String)
      : [],
    environmentMode: "REAL",
  };
}

export function pointSyncRelevantModule(moduleId: unknown): boolean {
  return moduleId === "people" || moduleId === "works";
}

/*
 * Salvar no Gestão 365 continua sendo a ação principal. Se o Ponto estiver
 * momentaneamente fora do ar, a alteração oficial não é desfeita; o erro fica
 * no log e a próxima alteração ou o botão manual reenviará o snapshot inteiro.
 */
export async function syncPointBestEffort(reason: string): Promise<void> {
  try {
    await syncOfficialDirectoryToPoint();
  } catch (error) {
    console.error(`Sincronização automática com o Beta Ponto pendente (${reason}).`, error);
  }
}
