/** Cloudflare Worker entry point for the vinext application. */
import {
  handleImageOptimization,
  DEFAULT_DEVICE_SIZES,
  DEFAULT_IMAGE_SIZES,
} from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import {
  handleImportRequest,
  processImportQueue,
} from "./imports/import-worker";
import type {
  ImportQueuePayload,
  ImportWorkerEnv,
} from "./imports/types";

interface Env extends ImportWorkerEnv {
  ASSETS: Fetcher;
  IMAGES?: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: {
          format: string;
          quality: number;
        }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

type GoogleJwtHeader = {
  alg?: string;
  kid?: string;
  typ?: string;
};

type GoogleJwtPayload = {
  aud?: string | string[];
  email?: string;
  email_verified?: boolean;
  exp?: number;
  iat?: number;
  iss?: string;
  nbf?: number;
  sub?: string;
};

type GoogleJwk = JsonWebKey & {
  alg?: string;
  kid?: string;
  use?: string;
};

type AdminSessionRow = {
  email: string;
  expiresAt: string;
};

const GOOGLE_CLIENT_ID =
  "1029361062935-9kd7sr8srn91vu9r4ekt0fjudfqbv1pk.apps.googleusercontent.com";
const GOOGLE_CERTS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const ADMIN_EMAIL = "scolarisamuel@gmail.com";
const ADMIN_SESSION_COOKIE = "__Host-beta_google_admin";
const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

let cachedGoogleKeys:
  | {
      expiresAt: number;
      keys: GoogleJwk[];
    }
  | undefined;
let adminSessionTablePromise: Promise<void> | undefined;

function decodeBase64UrlBytes(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    "=",
  );
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function decodeBase64UrlJson<T>(value: string): T {
  return JSON.parse(
    new TextDecoder().decode(decodeBase64UrlBytes(value)),
  ) as T;
}

function encodeBase64UrlBytes(value: Uint8Array) {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function requestCookie(request: Request, name: string) {
  const cookieHeader = request.headers.get("cookie") || "";
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() !== name) continue;
    return part.slice(separator + 1).trim();
  }
  return "";
}

function cacheMaxAge(response: Response) {
  const cacheControl = response.headers.get("cache-control") || "";
  const match = cacheControl.match(/(?:^|,)\s*max-age=(\d+)/i);
  const seconds = match ? Number(match[1]) : 3600;
  return Number.isFinite(seconds) && seconds > 0 ? seconds : 3600;
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

function randomSessionToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return encodeBase64UrlBytes(bytes);
}

function ensureAdminSessionTable(env: Env) {
  if (!adminSessionTablePromise) {
    adminSessionTablePromise = env.DB.batch([
      env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS admin_device_sessions (
          token_hash TEXT PRIMARY KEY,
          email TEXT NOT NULL,
          created_at TEXT NOT NULL,
          expires_at TEXT NOT NULL,
          last_seen_at TEXT NOT NULL
        )
      `),
      env.DB.prepare(`
        CREATE INDEX IF NOT EXISTS idx_admin_device_sessions_expires_at
        ON admin_device_sessions (expires_at)
      `),
    ])
      .then(() => undefined)
      .catch((error) => {
        adminSessionTablePromise = undefined;
        throw error;
      });
  }
  return adminSessionTablePromise;
}

async function createAdminDeviceSession(env: Env, email: string) {
  await ensureAdminSessionTable(env);

  const token = randomSessionToken();
  const tokenHash = await sha256Hex(token);
  const createdAt = new Date();
  const expiresAt = new Date(
    createdAt.getTime() + ADMIN_SESSION_TTL_SECONDS * 1000,
  );
  const createdAtIso = createdAt.toISOString();
  const expiresAtIso = expiresAt.toISOString();

  await env.DB.batch([
    env.DB.prepare(
      "DELETE FROM admin_device_sessions WHERE expires_at <= ?",
    ).bind(createdAtIso),
    env.DB.prepare(`
      INSERT OR REPLACE INTO admin_device_sessions
        (token_hash, email, created_at, expires_at, last_seen_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(
      tokenHash,
      email,
      createdAtIso,
      expiresAtIso,
      createdAtIso,
    ),
  ]);

  return { token, maxAge: ADMIN_SESSION_TTL_SECONDS };
}

async function deleteAdminDeviceSession(env: Env, token: string) {
  if (!token) return;
  await ensureAdminSessionTable(env);
  const tokenHash = await sha256Hex(token);
  await env.DB.prepare(
    "DELETE FROM admin_device_sessions WHERE token_hash = ?",
  )
    .bind(tokenHash)
    .run();
}

async function googleKeys() {
  if (cachedGoogleKeys && cachedGoogleKeys.expiresAt > Date.now()) {
    return cachedGoogleKeys.keys;
  }

  const response = await fetch(GOOGLE_CERTS_URL, {
    headers: { accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error("Não foi possível carregar as chaves públicas do Google.");
  }

  const result = (await response.json()) as { keys?: GoogleJwk[] };
  const keys = Array.isArray(result.keys) ? result.keys : [];
  if (!keys.length) {
    throw new Error("O Google não retornou chaves públicas de validação.");
  }

  cachedGoogleKeys = {
    keys,
    expiresAt: Date.now() + cacheMaxAge(response) * 1000,
  };
  return keys;
}

function audienceMatches(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value.includes(GOOGLE_CLIENT_ID);
  return value === GOOGLE_CLIENT_ID;
}

async function verifiedGoogleToken(token: string) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    const header = decodeBase64UrlJson<GoogleJwtHeader>(encodedHeader);
    const payload = decodeBase64UrlJson<GoogleJwtPayload>(encodedPayload);

    if (header.alg !== "RS256" || !header.kid) return null;
    if (!audienceMatches(payload.aud)) return null;
    if (
      payload.iss !== "accounts.google.com" &&
      payload.iss !== "https://accounts.google.com"
    ) {
      return null;
    }

    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp !== "number" || payload.exp <= now) return null;
    if (typeof payload.nbf === "number" && payload.nbf > now + 30) return null;
    if (typeof payload.iat === "number" && payload.iat > now + 30) return null;
    if (payload.email_verified !== true) return null;

    const keys = await googleKeys();
    const jwk = keys.find(
      (candidate) =>
        candidate.kid === header.kid &&
        (!candidate.alg || candidate.alg === "RS256") &&
        (!candidate.use || candidate.use === "sig"),
    );
    if (!jwk) return null;

    const publicKey = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const verified = await crypto.subtle.verify(
      { name: "RSASSA-PKCS1-v1_5" },
      publicKey,
      decodeBase64UrlBytes(encodedSignature),
      new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`),
    );
    return verified ? payload : null;
  } catch {
    return null;
  }
}

async function verifiedAdminSessionEmail(request: Request, env: Env) {
  const token = requestCookie(request, ADMIN_SESSION_COOKIE);
  if (!token) return null;

  // Mantém compatibilidade com a sessão curta criada antes da V69.
  if (token.split(".").length === 3) {
    const payload = await verifiedGoogleToken(token);
    const legacyEmail = String(payload?.email || "").trim().toLowerCase();
    return legacyEmail === ADMIN_EMAIL ? legacyEmail : null;
  }

  try {
    await ensureAdminSessionTable(env);
    const tokenHash = await sha256Hex(token);
    const row = await env.DB.prepare(`
      SELECT email, expires_at AS expiresAt
      FROM admin_device_sessions
      WHERE token_hash = ?
      LIMIT 1
    `)
      .bind(tokenHash)
      .first<AdminSessionRow>();

    if (!row) return null;
    const email = String(row.email || "").trim().toLowerCase();
    const expiresAt = Date.parse(String(row.expiresAt || ""));
    if (email !== ADMIN_EMAIL || !Number.isFinite(expiresAt)) return null;

    if (expiresAt <= Date.now()) {
      await env.DB.prepare(
        "DELETE FROM admin_device_sessions WHERE token_hash = ?",
      )
        .bind(tokenHash)
        .run();
      return null;
    }

    return email;
  } catch {
    return null;
  }
}

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
  extraHeaders?: HeadersInit,
) {
  const headers = new Headers(extraHeaders);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(JSON.stringify(body), { status, headers });
}

function redirectHome(request: Request, state: string, cookie?: string) {
  const destination = new URL("/", request.url);
  destination.searchParams.set("admin", state);
  const headers = new Headers({
    location: destination.toString(),
    "cache-control": "no-store",
  });
  if (cookie) headers.append("set-cookie", cookie);
  return new Response(null, { status: 302, headers });
}

function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return origin === new URL(request.url).origin;
}

async function handleAdminAccessRequest(request: Request, env: Env) {
  const url = new URL(request.url);

  if (url.pathname === "/admin-logout") {
    const token = requestCookie(request, ADMIN_SESSION_COOKIE);
    try {
      await deleteAdminDeviceSession(env, token);
    } catch {
      // A saída do navegador continua mesmo se a limpeza remota falhar.
    }
    return redirectHome(
      request,
      "expirado",
      `${ADMIN_SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`,
    );
  }

  if (url.pathname !== "/admin-google-login") return null;

  if (request.method !== "POST") {
    return jsonResponse({ message: "Método não permitido." }, 405, {
      allow: "POST",
    });
  }
  if (!isSameOrigin(request)) {
    return jsonResponse({ message: "Origem de login inválida." }, 403);
  }

  let credential = "";
  try {
    const body = (await request.json()) as { credential?: unknown };
    credential = String(body.credential || "").trim();
  } catch {
    return jsonResponse({ message: "Solicitação de login inválida." }, 400);
  }

  if (!credential || credential.length > 12_000) {
    return jsonResponse({ message: "Credencial do Google inválida." }, 400);
  }

  const payload = await verifiedGoogleToken(credential);
  const email = String(payload?.email || "").trim().toLowerCase();
  if (email !== ADMIN_EMAIL) {
    return jsonResponse(
      { message: "Esta conta Google não possui acesso administrativo." },
      403,
    );
  }

  try {
    const session = await createAdminDeviceSession(env, email);
    return jsonResponse(
      {
        ok: true,
        message: "Acesso administrativo autorizado neste dispositivo.",
        expiresInDays: 30,
      },
      200,
      {
        "set-cookie": `${ADMIN_SESSION_COOKIE}=${session.token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${session.maxAge}; Priority=High`,
      },
    );
  } catch {
    return jsonResponse(
      { message: "Não foi possível memorizar o acesso neste dispositivo." },
      503,
    );
  }
}

async function requestWithTrustedIdentity(request: Request, env: Env) {
  if (env.DEPLOYMENT_PLATFORM !== "cloudflare") return request;

  const headers = new Headers(request.headers);
  headers.delete("x-beta-authenticated-email");
  headers.delete("oai-authenticated-user-email");
  headers.delete("oai-authenticated-user-full-name");
  headers.delete("oai-authenticated-user-full-name-encoding");

  const email = await verifiedAdminSessionEmail(request, env);
  if (email) headers.set("x-beta-authenticated-email", email);

  return new Request(request, { headers });
}

const worker = {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);

    const adminResponse = await handleAdminAccessRequest(request, env);
    if (adminResponse) return adminResponse;

    if (url.pathname === "/_vinext/image") {
      if (!env.IMAGES) {
        return new Response("O otimizador de imagens não está habilitado.", {
          status: 404,
        });
      }
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(
        request,
        {
          fetchAsset: (path) =>
            env.ASSETS.fetch(new Request(new URL(path, request.url))),
          transformImage: async (body, { width, format, quality }) => {
            const result = await env.IMAGES!.input(body)
              .transform(width > 0 ? { width } : {})
              .output({ format, quality });
            return result.response();
          },
        },
        allowedWidths,
      );
    }

    const authenticatedRequest = await requestWithTrustedIdentity(request, env);
    const importResponse = await handleImportRequest(authenticatedRequest, env);
    if (importResponse) return importResponse;

    return handler.fetch(authenticatedRequest, env, ctx);
  },

  async queue(
    batch: MessageBatch<ImportQueuePayload>,
    env: Env,
  ): Promise<void> {
    await processImportQueue(batch, env);
  },
};

export default worker;
