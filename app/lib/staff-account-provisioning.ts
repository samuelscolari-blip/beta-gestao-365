import {
  cpfDigits,
  hasCompleteCpf,
  registrationFromCpf,
} from "./employee-registration";
import type { StaffRole } from "./staff-access";

const PASSWORD_ITERATIONS = 120_000;

type D1Statement = {
  bind(...values: unknown[]): D1Statement;
  run(): Promise<{ meta?: { changes?: number } }>;
  first<T>(): Promise<T | null>;
};

type D1DatabaseLike = {
  prepare(query: string): D1Statement;
};

async function database(): Promise<D1DatabaseLike> {
  const { env } = await import("cloudflare:workers");
  const db = (env as { DB?: D1DatabaseLike }).DB;
  if (!db) throw new Error("O banco de acesso não está disponível.");
  return db;
}

function encodeBase64Url(value: Uint8Array) {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function randomBytes(size: number) {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return bytes;
}

function generateTemporaryPassword() {
  const uppercase = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lowercase = "abcdefghijkmnopqrstuvwxyz";
  const numbers = "23456789";
  const symbols = "!@#$%";
  const all = `${uppercase}${lowercase}${numbers}${symbols}`;
  const bytes = randomBytes(12);
  const characters = [
    uppercase[bytes[0] % uppercase.length],
    lowercase[bytes[1] % lowercase.length],
    numbers[bytes[2] % numbers.length],
    symbols[bytes[3] % symbols.length],
    ...Array.from(bytes.slice(4), (byte) => all[byte % all.length]),
  ];
  return characters.join("");
}

async function hashPassword(password: string, salt: Uint8Array) {
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
      salt,
      iterations: PASSWORD_ITERATIONS,
    },
    key,
    256,
  );
  return encodeBase64Url(new Uint8Array(bits));
}

async function ensureAccountsTable(db: D1DatabaseLike) {
  await db
    .prepare(`
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
    `)
    .run();
}

export async function provisionStaffAccount(input: {
  name: unknown;
  cpf: unknown;
  role: unknown;
}) {
  const name = String(input.name ?? "").trim().slice(0, 160);
  const cpf = cpfDigits(input.cpf);
  const role: StaffRole = input.role === "encarregado" ? "encarregado" : "colaborador";

  if (!name) throw new Error("Informe o nome do colaborador.");
  if (!hasCompleteCpf(cpf)) {
    throw new Error("Informe os 11 dígitos do CPF para gerar a matrícula.");
  }

  const registration = registrationFromCpf(cpf);
  const db = await database();
  await ensureAccountsTable(db);
  const existing = await db
    .prepare(`
      SELECT registration
      FROM staff_access_accounts
      WHERE registration = ?
      LIMIT 1
    `)
    .bind(registration)
    .first<{ registration: string }>();
  if (existing) {
    throw new Error(
      `A matrícula ${registration} já está sendo usada. Verifique o CPF informado.`,
    );
  }

  const temporaryPassword = generateTemporaryPassword();
  const salt = randomBytes(16);
  const passwordHash = await hashPassword(temporaryPassword, salt);
  const now = new Date().toISOString();
  await db
    .prepare(`
      INSERT INTO staff_access_accounts (
        registration, name, role, password_salt, password_hash,
        active, failed_attempts, locked_until, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 1, 0, '', ?, ?)
    `)
    .bind(
      registration,
      name,
      role,
      encodeBase64Url(salt),
      passwordHash,
      now,
      now,
    )
    .run();

  return {
    registration,
    name,
    role,
    temporaryPassword,
  };
}
