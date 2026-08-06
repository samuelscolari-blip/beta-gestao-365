import { env } from "cloudflare:workers";

const TENANT_ID = "beta-construtora";
const FACE_MATCH_THRESHOLD = 0.5;
const MAX_PHOTO_LENGTH = 650_000;
const MAX_EMBEDDING_LENGTH = 2_048;

let schemaPromise: Promise<void> | undefined;

type EnrollmentPayload = {
  employeeCode?: unknown;
  employeeName?: unknown;
  sourceRecordId?: unknown;
  deviceToken?: unknown;
  embedding?: unknown;
  referencePhoto?: unknown;
  enrolledAt?: unknown;
};

type PunchPayload = {
  clientEventId?: unknown;
  employeeCode?: unknown;
  deviceToken?: unknown;
  eventType?: unknown;
  occurredAt?: unknown;
  timezone?: unknown;
  timezoneOffsetMinutes?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  accuracy?: unknown;
  embedding?: unknown;
  evidencePhoto?: unknown;
  livenessScore?: unknown;
  onlineAtCapture?: unknown;
};

type EmployeeRow = {
  id: string;
  employeeCode: string;
  employeeName: string;
  deviceTokenHash: string;
  embeddingJson: string;
  enrolledAt: string;
  active: number;
};

type EventRow = {
  clientEventId: string;
  employeeCode: string;
  employeeName: string;
  eventType: string;
  occurredAt: string;
  receivedAt: string;
  similarity: number;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  onlineAtCapture: number;
};

function text(value: unknown, maxLength = 240) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function normalizeEmployeeCode(value: unknown) {
  return text(value, 80)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "")
    .slice(0, 40);
}

function numberOrNull(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function booleanNumber(value: unknown) {
  return value === true || value === 1 || value === "1" ? 1 : 0;
}

function validPhoto(value: unknown) {
  const photo = text(value, MAX_PHOTO_LENGTH + 1);
  if (!photo) return "";
  if (!photo.startsWith("data:image/jpeg;base64,")) {
    throw new Error("A evidência facial precisa ser uma imagem JPEG válida.");
  }
  if (photo.length > MAX_PHOTO_LENGTH) {
    throw new Error("A evidência facial excedeu o tamanho permitido.");
  }
  return photo;
}

function validEmbedding(value: unknown) {
  if (!Array.isArray(value)) {
    throw new Error("A biometria facial não foi informada corretamente.");
  }
  const embedding = value.map(Number);
  if (
    embedding.length < 64 ||
    embedding.length > MAX_EMBEDDING_LENGTH ||
    embedding.some((item) => !Number.isFinite(item))
  ) {
    throw new Error("A biometria facial capturada é inválida.");
  }
  return embedding;
}

function isoDate(value: unknown, field: string) {
  const parsed = new Date(text(value, 80));
  if (!Number.isFinite(parsed.getTime())) {
    throw new Error(`${field} inválido.`);
  }
  return parsed.toISOString();
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function faceSimilarity(left: number[], right: number[]) {
  if (left.length !== right.length || left.length < 64) return 0;
  let sum = 0;
  for (let index = 0; index < left.length; index += 1) {
    const difference = left[index] - right[index];
    sum += difference * difference;
  }
  const distance = Math.round(100 * 25 * sum) / 100;
  if (distance === 0) return 1;
  const root = Math.sqrt(distance);
  const normalized = (1 - root / 100 - 0.2) / (0.8 - 0.2);
  return Math.round(100 * Math.max(Math.min(normalized, 1), 0)) / 100;
}

function json(body: Record<string, unknown>, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

function errorResponse(error: unknown) {
  const message =
    error instanceof Error ? error.message : "Não foi possível concluir a ação.";
  return json({ ok: false, error: message }, 400);
}

function ensureSchema() {
  if (!schemaPromise) {
    schemaPromise = env.DB.batch([
      env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS time_clock_employees (
          id TEXT PRIMARY KEY,
          tenant_id TEXT NOT NULL,
          employee_code TEXT NOT NULL,
          employee_name TEXT NOT NULL,
          source_record_id TEXT NOT NULL DEFAULT '',
          device_token_hash TEXT NOT NULL,
          face_embedding_json TEXT NOT NULL,
          reference_photo TEXT NOT NULL DEFAULT '',
          enrolled_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          active INTEGER NOT NULL DEFAULT 1,
          UNIQUE (tenant_id, employee_code)
        )
      `),
      env.DB.prepare(`
        CREATE INDEX IF NOT EXISTS idx_time_clock_employees_tenant_active
        ON time_clock_employees (tenant_id, active, employee_name)
      `),
      env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS time_clock_events (
          id TEXT PRIMARY KEY,
          tenant_id TEXT NOT NULL,
          client_event_id TEXT NOT NULL,
          employee_id TEXT NOT NULL,
          employee_code TEXT NOT NULL,
          employee_name TEXT NOT NULL,
          event_type TEXT NOT NULL,
          occurred_at TEXT NOT NULL,
          received_at TEXT NOT NULL,
          timezone TEXT NOT NULL DEFAULT '',
          timezone_offset_minutes INTEGER NOT NULL DEFAULT 0,
          latitude REAL,
          longitude REAL,
          accuracy REAL,
          face_similarity REAL NOT NULL,
          liveness_score REAL NOT NULL DEFAULT 0,
          evidence_photo TEXT NOT NULL DEFAULT '',
          online_at_capture INTEGER NOT NULL DEFAULT 0,
          sync_status TEXT NOT NULL DEFAULT 'SYNCED',
          UNIQUE (tenant_id, client_event_id),
          FOREIGN KEY (employee_id) REFERENCES time_clock_employees(id)
        )
      `),
      env.DB.prepare(`
        CREATE INDEX IF NOT EXISTS idx_time_clock_events_employee_date
        ON time_clock_events (tenant_id, employee_code, occurred_at DESC)
      `),
    ])
      .then(() => undefined)
      .catch((error) => {
        schemaPromise = undefined;
        throw error;
      });
  }
  return schemaPromise;
}

async function employeeByCode(employeeCode: string) {
  return env.DB.prepare(`
    SELECT
      id,
      employee_code AS employeeCode,
      employee_name AS employeeName,
      device_token_hash AS deviceTokenHash,
      face_embedding_json AS embeddingJson,
      enrolled_at AS enrolledAt,
      active
    FROM time_clock_employees
    WHERE tenant_id = ? AND employee_code = ?
    LIMIT 1
  `)
    .bind(TENANT_ID, employeeCode)
    .first<EmployeeRow>();
}

async function enroll(payload: EnrollmentPayload) {
  const employeeCode = normalizeEmployeeCode(payload.employeeCode);
  const employeeName = text(payload.employeeName, 160);
  const sourceRecordId = text(payload.sourceRecordId, 80);
  const deviceToken = text(payload.deviceToken, 300);
  const embedding = validEmbedding(payload.embedding);
  const referencePhoto = validPhoto(payload.referencePhoto);
  const enrolledAt = isoDate(payload.enrolledAt || new Date(), "Horário do cadastro");

  if (!employeeCode) throw new Error("Selecione ou informe o colaborador.");
  if (!employeeName) throw new Error("Informe o nome do colaborador.");
  if (deviceToken.length < 24) {
    throw new Error("O vínculo seguro deste celular não foi criado.");
  }

  const now = new Date().toISOString();
  const deviceTokenHash = await sha256Hex(deviceToken);
  const current = await employeeByCode(employeeCode);
  const employeeId = current?.id || crypto.randomUUID();

  await env.DB.prepare(`
    INSERT INTO time_clock_employees (
      id, tenant_id, employee_code, employee_name, source_record_id,
      device_token_hash, face_embedding_json, reference_photo,
      enrolled_at, updated_at, active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    ON CONFLICT (tenant_id, employee_code) DO UPDATE SET
      employee_name = excluded.employee_name,
      source_record_id = excluded.source_record_id,
      device_token_hash = excluded.device_token_hash,
      face_embedding_json = excluded.face_embedding_json,
      reference_photo = excluded.reference_photo,
      enrolled_at = excluded.enrolled_at,
      updated_at = excluded.updated_at,
      active = 1
  `)
    .bind(
      employeeId,
      TENANT_ID,
      employeeCode,
      employeeName,
      sourceRecordId,
      deviceTokenHash,
      JSON.stringify(embedding),
      referencePhoto,
      enrolledAt,
      now,
    )
    .run();

  return json(
    {
      ok: true,
      employee: {
        id: employeeId,
        employeeCode,
        employeeName,
        enrolledAt,
        active: true,
      },
      message: "Rosto cadastrado com sucesso. Seu acesso ao ponto está liberado.",
    },
    current ? 200 : 201,
  );
}

async function punch(payload: PunchPayload) {
  const clientEventId = text(payload.clientEventId, 100);
  const employeeCode = normalizeEmployeeCode(payload.employeeCode);
  const deviceToken = text(payload.deviceToken, 300);
  const eventType = text(payload.eventType, 40).toUpperCase();
  const occurredAt = isoDate(payload.occurredAt, "Horário da batida");
  const timezone = text(payload.timezone, 80);
  const timezoneOffsetMinutes = Math.trunc(
    numberOrNull(payload.timezoneOffsetMinutes) || 0,
  );
  const latitude = numberOrNull(payload.latitude);
  const longitude = numberOrNull(payload.longitude);
  const accuracy = numberOrNull(payload.accuracy);
  const currentEmbedding = validEmbedding(payload.embedding);
  const evidencePhoto = validPhoto(payload.evidencePhoto);
  const livenessScore = Math.max(
    0,
    Math.min(1, numberOrNull(payload.livenessScore) || 0),
  );
  const onlineAtCapture = booleanNumber(payload.onlineAtCapture);

  if (!clientEventId || clientEventId.length < 20) {
    throw new Error("Identificador da batida inválido.");
  }
  if (!employeeCode) throw new Error("Colaborador não identificado.");
  if (deviceToken.length < 24) throw new Error("Celular não vinculado.");
  if (!evidencePhoto) throw new Error("A foto do rosto é obrigatória.");
  if (!["ENTRADA", "INICIO_INTERVALO", "FIM_INTERVALO", "SAIDA"].includes(eventType)) {
    throw new Error("Tipo de batida inválido.");
  }
  if (latitude === null || longitude === null || accuracy === null) {
    throw new Error("A localização da batida é obrigatória.");
  }

  const employee = await employeeByCode(employeeCode);
  if (!employee || !employee.active) {
    return json(
      { ok: false, error: "O colaborador ainda não possui cadastro facial ativo." },
      404,
    );
  }

  const deviceTokenHash = await sha256Hex(deviceToken);
  if (deviceTokenHash !== employee.deviceTokenHash) {
    return json(
      {
        ok: false,
        error:
          "Este celular não está vinculado ao cadastro facial do colaborador.",
      },
      403,
    );
  }

  const enrolledEmbedding = JSON.parse(employee.embeddingJson) as unknown;
  const referenceEmbedding = validEmbedding(enrolledEmbedding);
  const similarity = faceSimilarity(referenceEmbedding, currentEmbedding);
  if (similarity < FACE_MATCH_THRESHOLD) {
    return json(
      {
        ok: false,
        error: "O rosto capturado não corresponde ao cadastro do colaborador.",
        similarity,
        threshold: FACE_MATCH_THRESHOLD,
      },
      422,
    );
  }

  const receivedAt = new Date().toISOString();
  const eventId = crypto.randomUUID();
  const insert = await env.DB.prepare(`
    INSERT OR IGNORE INTO time_clock_events (
      id, tenant_id, client_event_id, employee_id, employee_code,
      employee_name, event_type, occurred_at, received_at, timezone,
      timezone_offset_minutes, latitude, longitude, accuracy,
      face_similarity, liveness_score, evidence_photo,
      online_at_capture, sync_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SYNCED')
  `)
    .bind(
      eventId,
      TENANT_ID,
      clientEventId,
      employee.id,
      employee.employeeCode,
      employee.employeeName,
      eventType,
      occurredAt,
      receivedAt,
      timezone,
      timezoneOffsetMinutes,
      latitude,
      longitude,
      accuracy,
      similarity,
      livenessScore,
      evidencePhoto,
      onlineAtCapture,
    )
    .run();

  const inserted = Number(insert.meta?.changes || 0) > 0;
  const event = await env.DB.prepare(`
    SELECT
      client_event_id AS clientEventId,
      employee_code AS employeeCode,
      employee_name AS employeeName,
      event_type AS eventType,
      occurred_at AS occurredAt,
      received_at AS receivedAt,
      face_similarity AS similarity,
      latitude,
      longitude,
      accuracy,
      online_at_capture AS onlineAtCapture
    FROM time_clock_events
    WHERE tenant_id = ? AND client_event_id = ?
    LIMIT 1
  `)
    .bind(TENANT_ID, clientEventId)
    .first<EventRow>();

  return json({
    ok: true,
    duplicate: !inserted,
    event,
    message: inserted
      ? `Ponto registrado às ${new Intl.DateTimeFormat("pt-BR", {
          timeZone: timezone || "America/Sao_Paulo",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }).format(new Date(occurredAt))}.`
      : "Esta batida já havia sido sincronizada e não foi duplicada.",
  });
}

export async function GET(request: Request) {
  try {
    await ensureSchema();
    const url = new URL(request.url);
    const employeeCode = normalizeEmployeeCode(url.searchParams.get("employeeCode"));
    const view = url.searchParams.get("view") || "status";

    if (!employeeCode) {
      return json({ ok: false, error: "Informe o colaborador." }, 400);
    }

    const employee = await employeeByCode(employeeCode);
    if (!employee) {
      return json({ ok: true, enrolled: false, events: [] });
    }

    if (view !== "history") {
      return json({
        ok: true,
        enrolled: Boolean(employee.active),
        employee: {
          id: employee.id,
          employeeCode: employee.employeeCode,
          employeeName: employee.employeeName,
          enrolledAt: employee.enrolledAt,
        },
      });
    }

    const result = await env.DB.prepare(`
      SELECT
        client_event_id AS clientEventId,
        employee_code AS employeeCode,
        employee_name AS employeeName,
        event_type AS eventType,
        occurred_at AS occurredAt,
        received_at AS receivedAt,
        face_similarity AS similarity,
        latitude,
        longitude,
        accuracy,
        online_at_capture AS onlineAtCapture
      FROM time_clock_events
      WHERE tenant_id = ? AND employee_code = ?
      ORDER BY occurred_at DESC
      LIMIT 30
    `)
      .bind(TENANT_ID, employeeCode)
      .all<EventRow>();

    return json({
      ok: true,
      enrolled: Boolean(employee.active),
      employee: {
        id: employee.id,
        employeeCode: employee.employeeCode,
        employeeName: employee.employeeName,
        enrolledAt: employee.enrolledAt,
      },
      events: result.results || [],
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    await ensureSchema();
    const url = new URL(request.url);
    const action = url.searchParams.get("action");
    const payload = (await request.json()) as EnrollmentPayload & PunchPayload;

    if (action === "enroll") return enroll(payload);
    if (action === "punch") return punch(payload);
    return json({ ok: false, error: "Ação de ponto inválida." }, 404);
  } catch (error) {
    return errorResponse(error);
  }
}
