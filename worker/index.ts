/** Cloudflare Worker entry point for the vinext application. */
import {
  handleImageOptimization,
  DEFAULT_DEVICE_SIZES,
  DEFAULT_IMAGE_SIZES,
} from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
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
  DEPLOYMENT_PLATFORM?: string;
  TEAM_DOMAIN?: string;
  POLICY_AUD?: string;
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

function normalizeTeamDomain(value: string) {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
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

async function requestWithTrustedIdentity(request: Request, env: Env) {
  if (env.DEPLOYMENT_PLATFORM !== "cloudflare") return request;

  const headers = new Headers(request.headers);
  headers.delete("x-beta-authenticated-email");
  headers.delete("oai-authenticated-user-email");
  headers.delete("oai-authenticated-user-full-name");
  headers.delete("oai-authenticated-user-full-name-encoding");

  const email = await verifiedCloudflareAccessEmail(request, env);
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
    return handler.fetch(authenticatedRequest, env, ctx);
  },
};

export default worker;
