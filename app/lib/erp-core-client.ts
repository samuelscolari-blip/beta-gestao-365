type ErpCoreEnvironment = {
  ERP_CORE_BASE_URL?: string;
  ERP_CORE_CLIENT_ID?: string;
  ERP_CORE_HMAC_SECRET?: string;
  ERP_CORE_TENANT_ID?: string;
};

export type ErpCoreConfiguration = {
  baseUrl: string;
  clientId: string;
  hmacSecret: string;
  tenantId: string;
};

type ErpCoreRequestOptions = {
  method?: "GET" | "POST";
  actor: string;
  body?: unknown;
  idempotencyKey?: string;
  timeoutMs?: number;
};

async function workerEnvironment() {
  const { env } = await import("cloudflare:workers");
  return env as unknown as ErpCoreEnvironment;
}

export async function erpCoreConfiguration() {
  const env = await workerEnvironment();
  const configuration: ErpCoreConfiguration = {
    baseUrl: String(env.ERP_CORE_BASE_URL || "").replace(/\/+$/, ""),
    clientId: String(env.ERP_CORE_CLIENT_ID || ""),
    hmacSecret: String(env.ERP_CORE_HMAC_SECRET || ""),
    tenantId: String(env.ERP_CORE_TENANT_ID || ""),
  };
  const missing = Object.entries(configuration)
    .filter(([, value]) => !value)
    .map(([key]) => key);
  return {
    configured: missing.length === 0,
    missing,
    configuration,
  };
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function base64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function sha256Hex(value: Uint8Array) {
  const digest = await crypto.subtle.digest("SHA-256", value);
  return bytesToHex(new Uint8Array(digest));
}

async function signature(
  configuration: ErpCoreConfiguration,
  input: {
    timestamp: string;
    method: string;
    pathWithQuery: string;
    actor: string;
    idempotencyKey: string;
    body: Uint8Array;
  },
) {
  const canonical = [
    input.timestamp,
    input.method,
    input.pathWithQuery,
    configuration.tenantId,
    input.actor,
    input.idempotencyKey,
    await sha256Hex(input.body),
  ].join("\n");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(configuration.hmacSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(canonical),
  );
  return base64Url(new Uint8Array(signed));
}

export async function erpCoreRequest<T>(
  pathWithQuery: string,
  options: ErpCoreRequestOptions,
): Promise<T> {
  const state = await erpCoreConfiguration();
  if (!state.configured) {
    throw new Error("O núcleo ERP externo ainda não foi configurado.");
  }
  const method = options.method || "GET";
  const bodyText =
    options.body === undefined ? "" : JSON.stringify(options.body);
  const body = new TextEncoder().encode(bodyText);
  const timestamp = new Date().toISOString();
  const idempotencyKey = options.idempotencyKey || "";
  const signed = await signature(state.configuration, {
    timestamp,
    method,
    pathWithQuery,
    actor: options.actor,
    idempotencyKey,
    body,
  });
  const response = await fetch(
    `${state.configuration.baseUrl}${pathWithQuery}`,
    {
      method,
      headers: {
        ...(bodyText ? { "content-type": "application/json" } : {}),
        "x-erp-client-id": state.configuration.clientId,
        "x-erp-timestamp": timestamp,
        "x-erp-tenant-id": state.configuration.tenantId,
        "x-erp-actor": options.actor,
        "x-erp-idempotency-key": idempotencyKey,
        "x-erp-signature": signed,
      },
      body: bodyText || undefined,
      signal: AbortSignal.timeout(options.timeoutMs || 8_000),
    },
  );
  const payload = (await response.json().catch(() => ({}))) as {
    message?: string;
    error?: string;
  };
  if (!response.ok) {
    throw new Error(
      payload.message ||
        payload.error ||
        `O núcleo ERP respondeu com status ${response.status}.`,
    );
  }
  return payload as T;
}
