import {
  pointEmployeeByCpf,
  pointEmployeeByRegistration,
  type PointEmployee,
} from "./point-test-employees";

const MASTER_SESSION_COOKIE = "__Host-beta_master_point";
const MASTER_SESSION_TTL_SECONDS = 60 * 60 * 12;
const PASSWORD_ITERATIONS = 120_000;
const MASTER_PASSWORD_SALT = "uNqkN0ubXAG6OPfhJcCNLQ";
const MASTER_PASSWORD_HASH = "teryfOzA5Y5PfAoVytuHzMeUIpDcYuJrj68vZCMCiW8";

type D1Statement = {
  bind(...values: unknown[]): D1Statement;
  run(): Promise<{ meta?: { changes?: number } }>;
  first<T>(): Promise<T | null>;
};

type D1DatabaseLike = {
  prepare(query: string): D1Statement;
  batch(statements: D1Statement[]): Promise<unknown>;
};

export type SupervisorIdentity = {
  registration: string;
  name: string;
  role: "encarregado";
};

export type MasterPointSession = {
  actorRegistration: string;
  actorName: string;
  actorRole: "encarregado";
  selectedEmployeeRegistration: string;
  selectedEmployeeName: string;
  expiresAt: string;
};

type MasterPointSessionRow = {
  actorRegistration: string;
  actorName: string;
  selectedRegistration: string;
  expiresAt: string;
};

let schemaPromise: Promise<void> | undefined;

async function database(): Promise<D1DatabaseLike> {
  const { env } = await import("cloudflare:workers");
  const db = (env as { DB?: D1DatabaseLike }).DB;
  if (!db) throw new Error("O banco de acesso ao ponto não está disponível.");
  return db;
}

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    "=",
  );
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function encodeBase64Url(value: Uint8Array) {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
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

async function masterPasswordHash(password: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: decodeBase64Url(MASTER_PASSWORD_SALT),
      iterations: PASSWORD_ITERATIONS,
    },
    key,
    256,
  );
  return encodeBase64Url(new Uint8Array(bits));
}

function safeEqual(left: string, right: string) {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  const length = Math.max(leftBytes.length, rightBytes.length);
  let difference = leftBytes.length ^ rightBytes.length;
  for (let index = 0; index < length; index += 1) {
    difference |= (leftBytes[index] || 0) ^ (rightBytes[index] || 0);
  }
  return difference === 0;
}

function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return encodeBase64Url(bytes);
}

function cookieValue(headers: { get(name: string): string | null }, name: string) {
  const cookieHeader = headers.get("cookie") || "";
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() !== name) continue;
    return part.slice(separator + 1).trim();
  }
  return "";
}

async function ensureSchema() {
  if (!schemaPromise) {
    schemaPromise = database()
      .then((db) =>
        db.batch([
          db.prepare(`
            CREATE TABLE IF NOT EXISTS master_point_sessions_v2 (
              token_hash TEXT PRIMARY KEY,
              actor_registration TEXT NOT NULL,
              actor_name TEXT NOT NULL,
              selected_registration TEXT NOT NULL,
              created_at TEXT NOT NULL,
              expires_at TEXT NOT NULL,
              last_seen_at TEXT NOT NULL
            )
          `),
          db.prepare(`
            CREATE INDEX IF NOT EXISTS idx_master_point_sessions_v2_expires
            ON master_point_sessions_v2 (expires_at)
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

export async function verifyMasterPointAccess(input: {
  cpf: unknown;
  password: unknown;
}) {
  const employee = pointEmployeeByCpf(input.cpf);
  const password = String(input.password ?? "");
  if (!employee) {
    return {
      ok: false as const,
      error: "Selecione um CPF válido da lista de colaboradores.",
    };
  }
  if (password.length < 8 || password.length > 160) {
    return { ok: false as const, error: "Senha master inválida." };
  }

  const calculated = await masterPasswordHash(password);
  if (!safeEqual(calculated, MASTER_PASSWORD_HASH)) {
    return { ok: false as const, error: "Senha master inválida." };
  }

  return { ok: true as const, employee };
}

export async function createMasterPointSession(
  employee: PointEmployee,
  supervisor: SupervisorIdentity,
) {
  await ensureSchema();
  const token = randomToken();
  const tokenHash = await sha256Hex(token);
  const createdAt = new Date();
  const expiresAt = new Date(
    createdAt.getTime() + MASTER_SESSION_TTL_SECONDS * 1000,
  );
  const db = await database();

  await db.batch([
    db
      .prepare("DELETE FROM master_point_sessions_v2 WHERE expires_at <= ?")
      .bind(createdAt.toISOString()),
    db
      .prepare(`
        INSERT INTO master_point_sessions_v2 (
          token_hash, actor_registration, actor_name,
          selected_registration, created_at, expires_at, last_seen_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        tokenHash,
        supervisor.registration,
        supervisor.name,
        employee.registration,
        createdAt.toISOString(),
        expiresAt.toISOString(),
        createdAt.toISOString(),
      ),
  ]);

  return {
    token,
    expiresAt: expiresAt.toISOString(),
    maxAge: MASTER_SESSION_TTL_SECONDS,
  };
}

export async function masterPointSessionFromHeaders(headers: {
  get(name: string): string | null;
}): Promise<MasterPointSession | null> {
  const token = cookieValue(headers, MASTER_SESSION_COOKIE);
  if (!token) return null;

  try {
    await ensureSchema();
    const tokenHash = await sha256Hex(token);
    const db = await database();
    const row = await db
      .prepare(`
        SELECT
          actor_registration AS actorRegistration,
          actor_name AS actorName,
          selected_registration AS selectedRegistration,
          expires_at AS expiresAt
        FROM master_point_sessions_v2
        WHERE token_hash = ?
        LIMIT 1
      `)
      .bind(tokenHash)
      .first<MasterPointSessionRow>();

    const expiresAt = Date.parse(row?.expiresAt || "");
    if (!row || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      await db
        .prepare("DELETE FROM master_point_sessions_v2 WHERE token_hash = ?")
        .bind(tokenHash)
        .run();
      return null;
    }

    const employee = pointEmployeeByRegistration(row.selectedRegistration);
    if (!employee) return null;

    return {
      actorRegistration: row.actorRegistration,
      actorName: row.actorName,
      actorRole: "encarregado",
      selectedEmployeeRegistration: employee.registration,
      selectedEmployeeName: employee.name,
      expiresAt: row.expiresAt,
    };
  } catch {
    return null;
  }
}

export async function deleteMasterPointSession(headers: {
  get(name: string): string | null;
}) {
  const token = cookieValue(headers, MASTER_SESSION_COOKIE);
  if (!token) return;
  await ensureSchema();
  const db = await database();
  await db
    .prepare("DELETE FROM master_point_sessions_v2 WHERE token_hash = ?")
    .bind(await sha256Hex(token))
    .run();
}

export function masterPointSessionCookie(token: string, maxAge: number) {
  return `${MASTER_SESSION_COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}; Priority=High`;
}

export function clearMasterPointSessionCookie() {
  return `${MASTER_SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}
