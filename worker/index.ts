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
  ADMIN_SESSION_SECRET?: string;
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

type AccessJwtHeader = {
  alg?: string;
  kid?: string;
};

type AccessJwtPayload = {
  aud?: string | string[];
  email?: string;
  exp?: number;
  iss?: string;
  nbf?: number;
};

type AccessJwk = JsonWebKey & {
  kid?: string;
};

type AdminSessionPayload = {
  email: string;
  exp: number;
  iat: number;
};

const ADMIN_EMAIL = "scolarisamuel@gmail.com";
const ADMIN_SESSION_COOKIE = "__Host-beta_admin_session";
const ADMIN_SESSION_SECONDS = 8 * 60 * 60;

let cachedKeys:
  | {
      url: string;
      expiresAt: number;
      keys: AccessJwk[];
    }
  | undefined;

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

function encodeBase64UrlText(value: string) {
  return encodeBase64UrlBytes(new TextEncoder().encode(value));
}

function normalizeTeamDomain(value: string) {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
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

async function hmacKey(secret: string) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function createAdminSession(secret: string) {
  const now = Math.floor(Date.now() / 1000);
  const payload: AdminSessionPayload = {
    email: ADMIN_EMAIL,
    iat: now,
    exp: now + ADMIN_SESSION_SECONDS,
  };
  const encodedPayload = encodeBase64UrlText(JSON.stringify(payload));
  const signature = await crypto.subtle.sign(
    "HMAC",
    await hmacKey(secret),
    new TextEncoder().encode(encodedPayload),
  );
  return `${encodedPayload}.${encodeBase64UrlBytes(new Uint8Array(signature))}`;
}

async function verifiedAdminSessionEmail(request: Request, env: Env) {
  const secret = String(env.ADMIN_SESSION_SECRET || "");
  const token = requestCookie(request, ADMIN_SESSION_COOKIE);
  if (secret.length < 32 || !token) return null;

  try {
    const [encodedPayload, encodedSignature, extra] = token.split(".");
    if (!encodedPayload || !encodedSignature || extra) return null;

    const valid = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(secret),
      decodeBase64UrlBytes(encodedSignature),
      new TextEncoder().encode(encodedPayload),
    );
    if (!valid) return null;

    const payload = decodeBase64UrlJson<AdminSessionPayload>(encodedPayload);
    const now = Math.floor(Date.now() / 1000);
    if (payload.email !== ADMIN_EMAIL || payload.exp <= now || payload.iat > now + 30) {
      return null;
    }
    return payload.email;
  } catch {
    return null;
  }
}

async function accessKeys(teamDomain: string) {
  const url = `${teamDomain}/cdn-cgi/access/certs`;
  if (cachedKeys && cachedKeys.url === url && cachedKeys.expiresAt > Date.now()) {
    return cachedKeys.keys;
  }

  const response = await fetch(url, {
    headers: { accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error("Não foi possível carregar as chaves do Cloudflare Access.");
  }

  const result = (await response.json()) as { keys?: AccessJwk[] };
  const keys = Array.isArray(result.keys) ? result.keys : [];
  if (!keys.length) {
    throw new Error("O Cloudflare Access não retornou chaves de validação.");
  }

  cachedKeys = {
    url,
    keys,
    expiresAt: Date.now() + 60 * 60 * 1000,
  };
  return keys;
}

async function verifiedCloudflareAccessEmail(request: Request, env: Env) {
  const token = request.headers.get("cf-access-jwt-assertion");
  const teamDomain = normalizeTeamDomain(env.TEAM_DOMAIN || "");
  const audience = String(env.POLICY_AUD || "").trim();
  if (!token || !teamDomain || !audience) return null;

  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    const header = decodeBase64UrlJson<AccessJwtHeader>(encodedHeader);
    const payload = decodeBase64UrlJson<AccessJwtPayload>(encodedPayload);
    if (header.alg !== "RS256" || !header.kid) return null;

    const normalizedIssuer = String(payload.iss || "").replace(/\/+$/, "");
    if (normalizedIssuer !== teamDomain) return null;

    const tokenAudiences = Array.isArray(payload.aud)
      ? payload.aud
      : payload.aud
        ? [payload.aud]
        : [];
    if (!tokenAudiences.includes(audience)) return null;

    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp !== "number" || payload.exp <= now - 30) return null;
    if (typeof payload.nbf === "number" && payload.nbf > now + 30) return null;

    const keys = await accessKeys(teamDomain);
    const jwk = keys.find((candidate) => candidate.kid === header.kid);
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
    if (!verified) return null;

    const email = String(payload.email || "").trim().toLowerCase();
    return email || null;
  } catch {
    return null;
  }
}

function redirectHome(request: Request, state: string, cookie?: string) {
  const destination = new URL("/", request.url);
  destination.searchParams.set("admin", state);
  const headers = new Headers({ location: destination.toString() });
  if (cookie) headers.append("set-cookie", cookie);
  return new Response(null, { status: 302, headers });
}

async function handleAdminAccessRequest(request: Request, env: Env) {
  const url = new URL(request.url);

  if (url.pathname === "/admin-logout") {
    return redirectHome(
      request,
      "expirado",
      `${ADMIN_SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`,
    );
  }

  if (url.pathname !== "/admin-login") return null;

  const teamDomain = normalizeTeamDomain(env.TEAM_DOMAIN || "");
  const audience = String(env.POLICY_AUD || "").trim();
  const secret = String(env.ADMIN_SESSION_SECRET || "");
  if (!teamDomain || !audience || secret.length < 32) {
    return redirectHome(request, "configuracao-pendente");
  }

  const email = await verifiedCloudflareAccessEmail(request, env);
  if (email !== ADMIN_EMAIL) {
    return redirectHome(request, "nao-autorizado");
  }

  const session = await createAdminSession(secret);
  return redirectHome(
    request,
    "ativo",
    `${ADMIN_SESSION_COOKIE}=${session}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${ADMIN_SESSION_SECONDS}`,
  );
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