const STAFF_SESSION_COOKIE = "__Host-beta_staff_access";
export const STAFF_SESSION_TTL_SECONDS = 60 * 60 * 12;
const PASSWORD_ITERATIONS = 120_000;

export type StaffRole = "encarregado";

export type StaffSession = {
  registration: string;
  name: string;
  role: StaffRole;
  expiresAt: string;
};

type StaffAccountRow = {
  registration: string;
  name: string;
  role: StaffRole;
  passwordSalt: string;
  passwordHash: string;
  active: number;
  failedAttempts: number;
  lockedUntil: string;
};

type StaffSessionRow = StaffSession & {
  active: number;
};

type D1Statement = {
  bind(...values: unknown[]): D1Statement;
  run(): Promise<{ meta?: { changes?: number } }>;
  first<T>(): Promise<T | null>;
};

type D1DatabaseLike = {
  prepare(query: string): D1Statement;
  batch(statements: D1Statement[]): Promise<unknown>;
};

let schemaPromise: Promise<void> | undefined;

const TEST_ACCOUNTS = [
  {
    registration: "ENC-001",
    name: "Carlos Eduardo",
    role: "encarregado",
    passwordSalt: "pVAMkrtDjZqrSTC0a9It2g",
    passwordHash: "Raa9QnUJ2SuIpG3zQqxiMRxHKwPLWMMvb4EfKSxm6nc",
  },
  {
    registration: "ENC-002",
    name: "Ricardo Lima",
    role: "encarregado",
    passwordSalt: "sK0jIeQUBdoNr11oI-5-lA",
    passwordHash: "O3TCj-fjfvEVdW-FFEtuqgC3sEglofCryp8M4vU_40Q",
  },
  {
    registration: "ENC-003",
    name: "João Ferreira",
    role: "encarregado",
    passwordSalt: "dAf6BqOz12-aMwa16TAm9g",
    passwordHash: "8gPx0qohk8yQuq9i-wN3oFBAF1OmMU2jWF7N5m4VvWM",
  },
] as const;

async function database(): Promise<D1DatabaseLike> {
  const { env } = await import("cloudflare:workers");
  const db = (env as { DB?: D1DatabaseLike }).DB;
  if (!db) throw new Error("O banco de acesso não está disponível.");
  return db;
}

function normalizeRegistration(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "")
    .slice(0, 40);
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

async function passwordHash(password: string, encodedSalt: string) {
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
      salt: decodeBase64Url(encodedSalt),
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
      .then(async (db) => {
        await db.batch([
          db.prepare(`
            CREATE TABLE IF NOT EXISTS staff_access_accounts (
              registration TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              role TEXT NOT NULL,
              password_salt TEXT NOT NULL,
              password_hash TEXT NOT NULL,
              active INTEGER NOT NULL DEFAULT 1,
              failed_attempts INTEGER NOT NULL DEFAULT 0,
              locked_until TEXT NOT NULL DEFAULT '',
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
            )
          `),
          db.prepare(`
            CREATE TABLE IF NOT EXISTS staff_access_sessions (
              token_hash TEXT PRIMARY KEY,
              registration TEXT NOT NULL,
              created_at TEXT NOT NULL,
              expires_at TEXT NOT NULL,
              last_seen_at TEXT NOT NULL,
              FOREIGN KEY (registration) REFERENCES staff_access_accounts(registration)
            )
          `),
          db.prepare(`
            CREATE INDEX IF NOT EXISTS idx_staff_access_sessions_expires
            ON staff_access_sessions (expires_at)
          `),
        ]);

        const now = new Date().toISOString();
        await db.batch(
          TEST_ACCOUNTS.map((account) =>
            db
              .prepare(`
                INSERT OR IGNORE INTO staff_access_accounts (
                  registration, name, role, password_salt, password_hash,
                  active, failed_attempts, locked_until, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, 1, 0, '', ?, ?)
              `)
              .bind(
                account.registration,
                account.name,
                account.role,
                account.passwordSalt,
                account.passwordHash,
                now,
                now,
              ),
          ),
        );
      })
      .catch((error) => {
        schemaPromise = undefined;
        throw error;
      });
  }
  return schemaPromise;
}

export function hasStaffSessionCookie(headers: {
  get(name: string): string | null;
}) {
  return Boolean(cookieValue(headers, STAFF_SESSION_COOKIE));
}

export async function verifyStaffCredentials(
  registrationInput: unknown,
  passwordInput: unknown,
) {
  await ensureSchema();
  const registration = normalizeRegistration(registrationInput);
  const password = String(passwordInput ?? "");
  if (!registration || password.length < 8 || password.length > 160) {
    return { ok: false as const, error: "Matrícula ou senha inválida." };
  }

  const db = await database();
  const account = await db
    .prepare(`
      SELECT
        registration,
        name,
        role,
        password_salt AS passwordSalt,
        password_hash AS passwordHash,
        active,
        failed_attempts AS failedAttempts,
        locked_until AS lockedUntil
      FROM staff_access_accounts
      WHERE registration = ?
      LIMIT 1
    `)
    .bind(registration)
    .first<StaffAccountRow>();

  const now = new Date();
  const lockedUntil = Date.parse(account?.lockedUntil || "");
  if (
    account &&
    Number.isFinite(lockedUntil) &&
    lockedUntil > now.getTime()
  ) {
    return {
      ok: false as const,
      error: "Acesso temporariamente bloqueado após tentativas inválidas.",
    };
  }

  const calculated = account
    ? await passwordHash(password, account.passwordSalt)
    : await passwordHash(password, TEST_ACCOUNTS[0].passwordSalt);
  const valid = Boolean(
    account?.active && safeEqual(calculated, account.passwordHash),
  );

  if (!valid) {
    if (account) {
      const failedAttempts = Number(account.failedAttempts || 0) + 1;
      const nextLock = failedAttempts >= 5
        ? new Date(now.getTime() + 10 * 60 * 1000).toISOString()
        : "";
      await db
        .prepare(`
          UPDATE staff_access_accounts
          SET failed_attempts = ?, locked_until = ?, updated_at = ?
          WHERE registration = ?
        `)
        .bind(failedAttempts >= 5 ? 0 : failedAttempts, nextLock, now.toISOString(), registration)
        .run();
    }
    return { ok: false as const, error: "Matrícula ou senha inválida." };
  }

  await db
    .prepare(`
      UPDATE staff_access_accounts
      SET failed_attempts = 0, locked_until = '', updated_at = ?
      WHERE registration = ?
    `)
    .bind(now.toISOString(), registration)
    .run();

  return {
    ok: true as const,
    account: {
      registration: account!.registration,
      name: account!.name,
      role: account!.role,
    },
  };
}

export async function createStaffSession(account: {
  registration: string;
  name: string;
  role: StaffRole;
}) {
  await ensureSchema();
  const token = randomToken();
  const tokenHash = await sha256Hex(token);
  const createdAt = new Date();
  const expiresAt = new Date(
    createdAt.getTime() + STAFF_SESSION_TTL_SECONDS * 1000,
  );
  const db = await database();

  await db.batch([
    db
      .prepare("DELETE FROM staff_access_sessions WHERE expires_at <= ?")
      .bind(createdAt.toISOString()),
    db
      .prepare(`
        INSERT INTO staff_access_sessions (
          token_hash, registration, created_at, expires_at, last_seen_at
        ) VALUES (?, ?, ?, ?, ?)
      `)
      .bind(
        tokenHash,
        account.registration,
        createdAt.toISOString(),
        expiresAt.toISOString(),
        createdAt.toISOString(),
      ),
  ]);

  return {
    token,
    expiresAt: expiresAt.toISOString(),
    maxAge: STAFF_SESSION_TTL_SECONDS,
  };
}

export async function staffSessionFromHeaders(headers: {
  get(name: string): string | null;
}): Promise<StaffSession | null> {
  const token = cookieValue(headers, STAFF_SESSION_COOKIE);
  if (!token) return null;

  try {
    await ensureSchema();
    const tokenHash = await sha256Hex(token);
    const db = await database();
    const row = await db
      .prepare(`
        SELECT
          accounts.registration,
          accounts.name,
          accounts.role,
          accounts.active,
          sessions.expires_at AS expiresAt
        FROM staff_access_sessions sessions
        INNER JOIN staff_access_accounts accounts
          ON accounts.registration = sessions.registration
        WHERE sessions.token_hash = ?
        LIMIT 1
      `)
      .bind(tokenHash)
      .first<StaffSessionRow>();

    if (!row?.active || row.role !== "encarregado") return null;
    const expiresAt = Date.parse(row.expiresAt);
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      await db
        .prepare("DELETE FROM staff_access_sessions WHERE token_hash = ?")
        .bind(tokenHash)
        .run();
      return null;
    }

    return {
      registration: row.registration,
      name: row.name,
      role: row.role,
      expiresAt: row.expiresAt,
    };
  } catch {
    return null;
  }
}

export async function deleteStaffSession(headers: {
  get(name: string): string | null;
}) {
  const token = cookieValue(headers, STAFF_SESSION_COOKIE);
  if (!token) return;
  await ensureSchema();
  const db = await database();
  await db
    .prepare("DELETE FROM staff_access_sessions WHERE token_hash = ?")
    .bind(await sha256Hex(token))
    .run();
}

export function staffSessionCookie(token: string, maxAge: number) {
  return `${STAFF_SESSION_COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}; Priority=High`;
}

export function clearStaffSessionCookie() {
  return `${STAFF_SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}
