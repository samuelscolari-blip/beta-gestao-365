import {
  authenticatedEmail,
  SOLE_ADMIN_EMAIL,
} from "../../lib/server-access";
import {
  listActiveStaffAccounts,
  staffAccountByRegistration,
  staffSessionFromHeaders,
} from "../../lib/staff-access";

const TENANT_ID = "beta-construtora";
let schemaPromise;

async function database() {
  const { env } = await import("cloudflare:workers");
  if (!env.DB) throw new Error("O banco D1 do ponto não está disponível.");
  return env.DB;
}

function text(value, maxLength = 240) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function normalizeRegistration(value) {
  return text(value, 80)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "")
    .slice(0, 40);
}

function numberOrNull(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function booleanNumber(value) {
  return value === true || value === 1 || value === "1" ? 1 : 0;
}

function isoDate(value, field) {
  const parsed = new Date(text(value, 80));
  if (!Number.isFinite(parsed.getTime())) throw new Error(`${field} inválido.`);
  return parsed.toISOString();
}

function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

function errorResponse(error) {
  return json(
    {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível concluir a ação.",
    },
    400,
  );
}

async function ensureSchema() {
  if (!schemaPromise) {
    schemaPromise = database()
      .then((db) =>
        db.batch([
          db.prepare(`
            CREATE TABLE IF NOT EXISTS time_clock_entries (
              id TEXT PRIMARY KEY,
              tenant_id TEXT NOT NULL,
              client_event_id TEXT NOT NULL,
              employee_code TEXT NOT NULL,
              employee_name TEXT NOT NULL,
              actor_registration TEXT NOT NULL,
              actor_name TEXT NOT NULL,
              actor_role TEXT NOT NULL,
              event_type TEXT NOT NULL,
              occurred_at TEXT NOT NULL,
              received_at TEXT NOT NULL,
              timezone TEXT NOT NULL DEFAULT '',
              timezone_offset_minutes INTEGER NOT NULL DEFAULT 0,
              latitude REAL,
              longitude REAL,
              accuracy REAL,
              online_at_capture INTEGER NOT NULL DEFAULT 0,
              sync_status TEXT NOT NULL DEFAULT 'SYNCED',
              UNIQUE (tenant_id, client_event_id)
            )
          `),
          db.prepare(`
            CREATE INDEX IF NOT EXISTS idx_time_clock_entries_employee_date
            ON time_clock_entries (tenant_id, employee_code, occurred_at DESC)
          `),
          db.prepare(`
            CREATE INDEX IF NOT EXISTS idx_time_clock_entries_actor_date
            ON time_clock_entries (tenant_id, actor_registration, occurred_at DESC)
          `),
        ]),
      )
      .then(() => undefined)
      .catch((error) => {
        schemaPromise = undefined;
        throw error;
      });
  }
  return schemaPromise;
}

async function accessActor(request) {
  const email = authenticatedEmail(request);
  if (email === SOLE_ADMIN_EMAIL) {
    return {
      registration: "ADMIN",
      name: "Samuel Scolari",
      role: "administrador",
    };
  }
  return staffSessionFromHeaders(request.headers);
}

function canActFor(actor, employeeCode) {
  if (!actor) return false;
  if (actor.role === "administrador" || actor.role === "encarregado") {
    return true;
  }
  return actor.role === "colaborador" && actor.registration === employeeCode;
}

async function availableEmployees(actor) {
  if (actor.role === "colaborador") {
    const own = await staffAccountByRegistration(actor.registration);
    return own ? [own] : [];
  }
  return listActiveStaffAccounts();
}

async function punch(request, payload) {
  const actor = await accessActor(request);
  if (!actor) {
    return json(
      { ok: false, error: "Entre novamente para registrar o ponto." },
      401,
    );
  }

  const clientEventId = text(payload.clientEventId, 100);
  const employeeCode = normalizeRegistration(payload.employeeCode);
  const eventType = text(payload.eventType, 40).toUpperCase();
  const occurredAt = isoDate(payload.occurredAt, "Horário da batida");
  const timezone = text(payload.timezone, 80);
  const timezoneOffsetMinutes = Math.trunc(
    numberOrNull(payload.timezoneOffsetMinutes) || 0,
  );
  const latitude = numberOrNull(payload.latitude);
  const longitude = numberOrNull(payload.longitude);
  const accuracy = numberOrNull(payload.accuracy);
  const onlineAtCapture = booleanNumber(payload.onlineAtCapture);

  if (!clientEventId || clientEventId.length < 20) {
    throw new Error("Identificador da batida inválido.");
  }
  if (!employeeCode) throw new Error("Colaborador não identificado.");
  if (
    !["ENTRADA", "INICIO_INTERVALO", "FIM_INTERVALO", "SAIDA"].includes(
      eventType,
    )
  ) {
    throw new Error("Tipo de batida inválido.");
  }
  if (latitude === null || longitude === null || accuracy === null) {
    throw new Error("A localização da batida é obrigatória.");
  }
  if (!canActFor(actor, employeeCode)) {
    return json(
      {
        ok: false,
        error: "O colaborador só pode registrar o próprio ponto.",
      },
      403,
    );
  }

  const employee = await staffAccountByRegistration(employeeCode);
  if (!employee) {
    return json(
      { ok: false, error: "Colaborador não encontrado ou inativo." },
      404,
    );
  }

  const receivedAt = new Date().toISOString();
  const db = await database();
  const insert = await db
    .prepare(`
      INSERT OR IGNORE INTO time_clock_entries (
        id, tenant_id, client_event_id, employee_code, employee_name,
        actor_registration, actor_name, actor_role, event_type,
        occurred_at, received_at, timezone, timezone_offset_minutes,
        latitude, longitude, accuracy, online_at_capture, sync_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SYNCED')
    `)
    .bind(
      crypto.randomUUID(),
      TENANT_ID,
      clientEventId,
      employee.registration,
      employee.name,
      actor.registration,
      actor.name,
      actor.role,
      eventType,
      occurredAt,
      receivedAt,
      timezone,
      timezoneOffsetMinutes,
      latitude,
      longitude,
      accuracy,
      onlineAtCapture,
    )
    .run();

  const inserted = Number(insert.meta?.changes || 0) > 0;
  const event = await db
    .prepare(`
      SELECT
        client_event_id AS clientEventId,
        employee_code AS employeeCode,
        employee_name AS employeeName,
        actor_registration AS actorRegistration,
        actor_name AS actorName,
        actor_role AS actorRole,
        event_type AS eventType,
        occurred_at AS occurredAt,
        received_at AS receivedAt,
        latitude,
        longitude,
        accuracy,
        online_at_capture AS onlineAtCapture
      FROM time_clock_entries
      WHERE tenant_id = ? AND client_event_id = ?
      LIMIT 1
    `)
    .bind(TENANT_ID, clientEventId)
    .first();

  let displayedTime = occurredAt.slice(11, 19);
  try {
    displayedTime = new Intl.DateTimeFormat("pt-BR", {
      timeZone: timezone || "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(new Date(occurredAt));
  } catch {
    // Mantém o horário ISO caso o navegador envie um fuso inválido.
  }

  const actingForAnother = actor.registration !== employee.registration;
  return json({
    ok: true,
    duplicate: !inserted,
    event,
    message: inserted
      ? actingForAnother
        ? `Ponto de ${employee.name} registrado às ${displayedTime} por ${actor.name}.`
        : `Ponto registrado às ${displayedTime}.`
      : "Esta batida já havia sido sincronizada e não foi duplicada.",
  });
}

export async function GET(request) {
  try {
    await ensureSchema();
    const actor = await accessActor(request);
    if (!actor) {
      return json(
        { ok: false, error: "Entre novamente para acessar o ponto." },
        401,
      );
    }

    const url = new URL(request.url);
    const action = url.searchParams.get("action") || "employees";
    if (action === "employees") {
      return json({
        ok: true,
        actor: {
          registration: actor.registration,
          name: actor.name,
          role: actor.role,
        },
        employees: await availableEmployees(actor),
      });
    }

    if (action !== "history") {
      return json({ ok: false, error: "Consulta de ponto inválida." }, 404);
    }

    const employeeCode = normalizeRegistration(
      url.searchParams.get("employeeCode"),
    );
    if (!employeeCode || !canActFor(actor, employeeCode)) {
      return json(
        { ok: false, error: "Acesso ao histórico não autorizado." },
        403,
      );
    }

    const db = await database();
    const result = await db
      .prepare(`
        SELECT
          client_event_id AS clientEventId,
          employee_code AS employeeCode,
          employee_name AS employeeName,
          actor_registration AS actorRegistration,
          actor_name AS actorName,
          actor_role AS actorRole,
          event_type AS eventType,
          occurred_at AS occurredAt,
          received_at AS receivedAt,
          latitude,
          longitude,
          accuracy,
          online_at_capture AS onlineAtCapture
        FROM time_clock_entries
        WHERE tenant_id = ? AND employee_code = ?
        ORDER BY occurred_at DESC
        LIMIT 50
      `)
      .bind(TENANT_ID, employeeCode)
      .all();

    return json({
      ok: true,
      events: result.results || [],
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request) {
  try {
    await ensureSchema();
    const url = new URL(request.url);
    const action = url.searchParams.get("action");
    const payload = await request.json();
    if (action === "punch") return punch(request, payload);
    return json({ ok: false, error: "Ação de ponto inválida." }, 404);
  } catch (error) {
    return errorResponse(error);
  }
}
