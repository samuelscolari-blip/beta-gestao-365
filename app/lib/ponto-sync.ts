import { listRecords } from "../../db/records";
import { DEMO_SOURCE } from "../../db/demo-records";

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

type PointEnvironmentResponse = {
  ok?: boolean;
  mode?: unknown;
  message?: string;
  [key: string]: unknown;
};

type PointPerson = {
  sourceRecordId: string;
  employeeNumber: string;
  fullName: string;
  jobTitle: string | null;
  scheduleLabel: string | null;
  employmentStatus: "ACTIVE" | "ON_LEAVE" | "TERMINATED";
  role: PointRole;
  worksite: {
    sourceRecordId: string;
    code: string;
    name: string;
    status: "ACTIVE" | "INACTIVE" | "COMPLETED";
  } | null;
};

type PointSyncOptions = {
  /**
   * A sincronização automática nunca altera o ambiente. Somente a ação
   * administrativa explícita pode pedir a primeira ativação em BASE REAL.
   */
  activateReal?: boolean;
};

const INITIAL_REAL_DIRECTORY_TOTAL = 42;
const INITIAL_REAL_WORKSITE = "ASA BRANCA";

/*
 * Perfis iniciais definidos pelo código oficial do RH, nunca pelo nome.
 *
 * O campo canRegisterTeamPoint passa a ser a autoridade editável. Enquanto
 * esses três cadastros ainda não foram regravados com o novo campo, os códigos
 * oficiais abaixo garantem a liberação solicitada. Um valor explícito "Não"
 * sempre revoga a permissão, inclusive para estes códigos.
 */
const INITIAL_TEAM_POINT_OPERATOR_CODES = new Set([
  "20029",
  "20033",
  "20044",
]);

export type PointSyncResult = {
  ok: true;
  total: number;
  worksites: string[];
  created: number;
  updated: number;
  deactivated: number;
  semAcesso: string[];
  environmentMode: "REAL" | "UNCHANGED";
  environmentAction: "ACTIVATED" | "ALREADY_REAL" | "UNCHANGED";
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

function explicitTeamPointPermission(value: unknown): boolean | null {
  const configured = normalize(value);
  if (["sim", "true", "1"].includes(configured)) return true;
  if (["nao", "false", "0"].includes(configured)) return false;
  return null;
}

function pointRole(
  person: Record<string, unknown>,
  recordReference: unknown,
): PointRole {
  const explicitPermission = explicitTeamPointPermission(
    person.canRegisterTeamPoint,
  );
  if (explicitPermission === true) return "OPERATOR";
  if (explicitPermission === false) return "EMPLOYEE_SELF_SERVICE";

  const employeeCode = onlyDigits(person.employeeCode || recordReference);
  if (INITIAL_TEAM_POINT_OPERATOR_CODES.has(employeeCode)) return "OPERATOR";

  const role = String(person.role || "")
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

function onlyDigits(value: unknown) {
  return String(value || "").replace(/\D/g, "");
}

/*
 * O login legado do Ponto foi entregue como os cinco primeiros dígitos do
 * CPF. O CPF completo continua exclusivamente no Gestão 365: usamos-o aqui
 * para derivar a matrícula operacional e enviamos somente os cinco dígitos.
 * Se um cadastro futuro não tiver CPF, o campo próprio do relógio é aceito,
 * desde que já contenha exatamente cinco dígitos.
 */
function operationalEmployeeNumber(person: Record<string, unknown>) {
  const cpfDigits = onlyDigits(person.cpf);
  if (cpfDigits.length === 11) return cpfDigits.slice(0, 5);

  const configured = onlyDigits(person.timeClockEmployeeId);
  return configured.length === 5 ? configured : "";
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

function remoteDetails(
  response: Response,
  body: Record<string, unknown>,
): Record<string, unknown> {
  return {
    ...body,
    httpStatus: response.status,
  };
}

function remoteFailureMessage(response: Response, fallback: string) {
  if (response.status === 401) {
    return (
      "O Beta Ponto recusou a credencial da integração. " +
      "Confira se GESTAO_365_SYNC_TOKEN é idêntico nos dois Workers."
    );
  }
  if (response.status === 404) {
    return (
      "O endpoint de integração não existe na versão publicada do Beta Ponto. " +
      "Publique primeiro o receptor oficial."
    );
  }
  return fallback;
}

async function pointEnvironmentMode(baseUrl: string) {
  const response = await fetch(`${baseUrl}/api/environment`, {
    cache: "no-store",
  });
  const body = (await json(response)) as PointEnvironmentResponse;
  const mode = String(body.mode || "").toUpperCase();
  if (!response.ok || (mode !== "DEMO" && mode !== "REAL")) {
    throw new PointSyncError(
      remoteFailureMessage(
        response,
        "Não foi possível confirmar o ambiente atual do Beta Ponto.",
      ),
      "environment",
      remoteDetails(response, body),
    );
  }
  return mode as "DEMO" | "REAL";
}

function ensureUniqueEmployeeNumbers(payload: PointPerson[]) {
  const byNumber = new Map<string, string[]>();
  payload.forEach((person) => {
    const names = byNumber.get(person.employeeNumber) || [];
    names.push(person.fullName);
    byNumber.set(person.employeeNumber, names);
  });
  const duplicates = Array.from(byNumber.entries())
    .filter(([, names]) => names.length > 1)
    .map(([employeeNumber, names]) => ({ employeeNumber, names }));
  if (!duplicates.length) return;

  throw new PointSyncError(
    "Há matrículas operacionais repetidas. Corrija os CPFs antes de sincronizar.",
    "source",
    { duplicates },
  );
}

function ensureInitialActivationSource(payload: PointPerson[]) {
  if (payload.length !== INITIAL_REAL_DIRECTORY_TOTAL) {
    throw new PointSyncError(
      `A ativação inicial exige exatamente ${INITIAL_REAL_DIRECTORY_TOTAL} funcionários oficiais.`,
      "source",
      { expected: INITIAL_REAL_DIRECTORY_TOTAL, received: payload.length },
    );
  }

  const wrongWorksite = payload
    .filter(
      (person) =>
        normalize(person.worksite?.name) !== normalize(INITIAL_REAL_WORKSITE),
    )
    .map((person) => ({
      employeeNumber: person.employeeNumber,
      fullName: person.fullName,
      worksite: person.worksite?.name || null,
    }));
  if (wrongWorksite.length) {
    throw new PointSyncError(
      `A ativação inicial exige todos os funcionários vinculados à obra ${INITIAL_REAL_WORKSITE}.`,
      "source",
      { wrongWorksite },
    );
  }

  const withoutSchedule = payload
    .filter((person) => !person.scheduleLabel)
    .map((person) => ({
      employeeNumber: person.employeeNumber,
      fullName: person.fullName,
    }));
  if (withoutSchedule.length) {
    throw new PointSyncError(
      "A ativação inicial exige uma jornada preenchida para todos os funcionários.",
      "source",
      { withoutSchedule },
    );
  }

  const operators = payload.filter((person) => person.role === "OPERATOR");
  if (!operators.length) {
    throw new PointSyncError(
      "A ativação inicial exige ao menos um encarregado com perfil para registrar o ponto da equipe.",
      "source",
    );
  }
}

function ensureInitialActivationSync(
  payload: PointPerson[],
  synced: PointSyncResponse,
) {
  const processed = Number(synced.created || 0) + Number(synced.updated || 0);
  if (processed !== payload.length) {
    throw new PointSyncError(
      "O Beta Ponto não confirmou o processamento de todo o quadro oficial; a BASE REAL não foi ativada.",
      "sync",
      {
        expected: payload.length,
        processed,
        created: Number(synced.created || 0),
        updated: Number(synced.updated || 0),
      },
    );
  }

  const semAcesso = Array.isArray(synced.semAcesso)
    ? synced.semAcesso.map(String)
    : [];
  if (semAcesso.length) {
    throw new PointSyncError(
      "O quadro foi sincronizado, mas há funcionários sem credencial de acesso; a BASE REAL não foi ativada.",
      "sync",
      { semAcesso },
    );
  }
}

/*
 * Uma única rotina para botão manual e sincronização automática.
 *
 * A ordem é deliberada: primeiro valida, depois envia o retrato completo das
 * pessoas. A BASE REAL só é ativada quando um administrador pede isso
 * explicitamente e todos os invariantes do primeiro quadro oficial passam.
 */
export async function syncOfficialDirectoryToPoint(
  options: PointSyncOptions = {},
): Promise<PointSyncResult> {
  const { token, baseUrl } = await integrationConfig();
  if (!token) {
    throw new PointSyncError(
      "A integração com o Beta Ponto ainda não possui GESTAO_365_SYNC_TOKEN configurado.",
      "configuration",
    );
  }

  const [storedPeople, storedWorks] = await Promise.all([
    listRecords("people"),
    listRecords("works"),
  ]);
  const people = storedPeople.filter((record) => record.source !== DEMO_SOURCE);
  const works = storedWorks.filter((record) => record.source !== DEMO_SOURCE);

  const currentEnvironment = options.activateReal
    ? await pointEnvironmentMode(baseUrl)
    : null;
  const initialActivation =
    options.activateReal === true && currentEnvironment !== "REAL";

  const workByName = new Map(
    works.map((record) => [normalize(record.payload.name || record.title), record]),
  );

  const payload: PointPerson[] = people.map((record) => {
    const person = record.payload;
    const workName = String(person.work || "").trim();
    const workRecord = workByName.get(normalize(workName));
    const employeeNumber = operationalEmployeeNumber(person);

    if (!employeeNumber) {
      throw new PointSyncError(
        "Há funcionário sem CPF válido nem identificador de ponto com cinco dígitos.",
        "source",
        {
          recordId: record.id,
          fullName: String(person.name || record.title).trim(),
        },
      );
    }

    if (workName && !workRecord) {
      throw new PointSyncError(
        "Há funcionário vinculado a uma obra que não existe no cadastro oficial de Obras.",
        "source",
        {
          employeeNumber,
          fullName: String(person.name || record.title).trim(),
          worksite: workName,
        },
      );
    }

    return {
      sourceRecordId: `beta-gestao-365:people:${record.id}`,
      employeeNumber,
      fullName: String(person.name || record.title).trim(),
      jobTitle: String(person.role || "").trim() || null,
      scheduleLabel: scheduleLabel(person) || null,
      employmentStatus: employmentStatus(record.status || person.status),
      role: pointRole(person, record.reference),
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

  ensureUniqueEmployeeNumbers(payload);
  if (initialActivation) ensureInitialActivationSource(payload);

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
      remoteFailureMessage(
        validationResponse,
        "O Beta Ponto recusou a validação do quadro de funcionários.",
      ),
      "validate",
      remoteDetails(validationResponse, validation),
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
      remoteFailureMessage(
        syncResponse,
        "O Beta Ponto não concluiu a sincronização do cadastro.",
      ),
      "sync",
      remoteDetails(syncResponse, synced),
    );
  }

  if (initialActivation) {
    ensureInitialActivationSync(payload, synced);
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
        remoteFailureMessage(
          modeResponse,
          "O cadastro foi sincronizado, mas o Beta Ponto não confirmou a BASE REAL.",
        ),
        "environment",
        remoteDetails(modeResponse, mode),
      );
    }
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
    environmentMode:
      initialActivation || currentEnvironment === "REAL" ? "REAL" : "UNCHANGED",
    environmentAction: initialActivation
      ? "ACTIVATED"
      : currentEnvironment === "REAL"
        ? "ALREADY_REAL"
        : "UNCHANGED",
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
    await syncOfficialDirectoryToPoint({ activateReal: false });
  } catch (error) {
    console.error(`Sincronização automática com o Beta Ponto pendente (${reason}).`, error);
  }
}
