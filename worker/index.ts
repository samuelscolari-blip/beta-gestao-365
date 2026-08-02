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

const GOOGLE_CLIENT_ID =
  "1029361062935-9kd7sr8srn91vu9r4ekt0fjudfqbv1pk.apps.googleusercontent.com";
const GOOGLE_CERTS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const ADMIN_EMAIL = "scolarisamuel@gmail.com";
const ADMIN_SESSION_COOKIE = "__Host-beta_google_admin";

let cachedGoogleKeys:
  | {
      expiresAt: number;
      keys: GoogleJwk[];
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

async function verifiedAdminSessionEmail(request: Request) {
  const token = requestCookie(request, ADMIN_SESSION_COOKIE);
  if (!token) return null;

  const payload = await verifiedGoogleToken(token);
  const email = String(payload?.email || "").trim().toLowerCase();
  return email === ADMIN_EMAIL ? email : null;
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

async function handleAdminAccessRequest(request: Request) {
  const url = new URL(request.url);

  if (url.pathname === "/admin-logout") {
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

  const now = Math.floor(Date.now() / 1000);
  const maxAge = Math.max(1, Math.min(3600, Number(payload?.exp || now) - now));
  return jsonResponse(
    { ok: true, message: "Acesso administrativo autorizado." },
    200,
    {
      "set-cookie": `${ADMIN_SESSION_COOKIE}=${credential}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`,
    },
  );
}

async function requestWithTrustedIdentity(request: Request, env: Env) {
  if (env.DEPLOYMENT_PLATFORM !== "cloudflare") return request;

  const headers = new Headers(request.headers);
  headers.delete("x-beta-authenticated-email");
  headers.delete("oai-authenticated-user-email");
  headers.delete("oai-authenticated-user-full-name");
  headers.delete("oai-authenticated-user-full-name-encoding");

  const email = await verifiedAdminSessionEmail(request);
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

    const adminResponse = await handleAdminAccessRequest(request);
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
