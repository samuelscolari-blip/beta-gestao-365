import type { ConnectionOptions } from "bullmq";

export type CertificateProvider = "DISABLED" | "A1_PFX" | "EXTERNAL_HSM";

export type ErpCoreConfig = {
  nodeEnv: string;
  port: number;
  databaseUrl: string;
  databasePoolSize: number;
  redisUrl: string;
  serviceClientId: string;
  serviceHmacSecret: string;
  allowedOrigins: string[];
  payloadEncryptionKey: Buffer;
  certificateProvider: CertificateProvider;
  certificatePfxBase64: string;
  certificatePfxPassword: string;
  payrollWorkerConcurrency: number;
  fiscalWorkerConcurrency: number;
};

let cachedConfig: ErpCoreConfig | null = null;

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Configuração obrigatória ausente: ${name}.`);
  return value;
}

function positiveInteger(name: string, fallback: number) {
  const value = Number(process.env[name] || fallback);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} deve ser um número inteiro positivo.`);
  }
  return value;
}

function encryptionKey() {
  const value = required("PAYLOAD_ENCRYPTION_KEY_BASE64");
  const key = Buffer.from(value, "base64");
  if (key.byteLength !== 32) {
    throw new Error(
      "PAYLOAD_ENCRYPTION_KEY_BASE64 deve representar exatamente 32 bytes.",
    );
  }
  return key;
}

function certificateProvider(): CertificateProvider {
  const value = (process.env.CERTIFICATE_PROVIDER || "DISABLED").trim();
  if (!["DISABLED", "A1_PFX", "EXTERNAL_HSM"].includes(value)) {
    throw new Error(
      "CERTIFICATE_PROVIDER deve ser DISABLED, A1_PFX ou EXTERNAL_HSM.",
    );
  }
  return value as CertificateProvider;
}

export function loadConfig(): ErpCoreConfig {
  if (cachedConfig) return cachedConfig;
  const serviceHmacSecret = required("ERP_SERVICE_HMAC_SECRET");
  if (Buffer.byteLength(serviceHmacSecret) < 32) {
    throw new Error("ERP_SERVICE_HMAC_SECRET deve possuir ao menos 32 bytes.");
  }

  const provider = certificateProvider();
  const certificatePfxBase64 =
    process.env.CERTIFICATE_PFX_BASE64?.trim() || "";
  const certificatePfxPassword =
    process.env.CERTIFICATE_PFX_PASSWORD || "";
  if (
    provider === "A1_PFX" &&
    (!certificatePfxBase64 || !certificatePfxPassword)
  ) {
    throw new Error(
      "O provedor A1_PFX exige CERTIFICATE_PFX_BASE64 e CERTIFICATE_PFX_PASSWORD.",
    );
  }

  cachedConfig = {
    nodeEnv: process.env.NODE_ENV || "development",
    port: positiveInteger("PORT", 8080),
    databaseUrl: required("DATABASE_URL"),
    databasePoolSize: positiveInteger("DATABASE_POOL_SIZE", 20),
    redisUrl: required("REDIS_URL"),
    serviceClientId: required("ERP_SERVICE_CLIENT_ID"),
    serviceHmacSecret,
    allowedOrigins: (process.env.ERP_ALLOWED_ORIGINS || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
    payloadEncryptionKey: encryptionKey(),
    certificateProvider: provider,
    certificatePfxBase64,
    certificatePfxPassword,
    payrollWorkerConcurrency: positiveInteger(
      "PAYROLL_WORKER_CONCURRENCY",
      4,
    ),
    fiscalWorkerConcurrency: positiveInteger(
      "FISCAL_WORKER_CONCURRENCY",
      2,
    ),
  };
  return cachedConfig;
}

export function resetConfigForTests() {
  cachedConfig = null;
}

export function redisConnectionOptions(
  role: "producer" | "worker" = "worker",
): ConnectionOptions {
  const parsed = new URL(loadConfig().redisUrl);
  const databasePath = parsed.pathname.replace(/^\//, "");
  return {
    host: parsed.hostname,
    port: Number(parsed.port || 6379),
    username: parsed.username
      ? decodeURIComponent(parsed.username)
      : undefined,
    password: parsed.password
      ? decodeURIComponent(parsed.password)
      : undefined,
    db: databasePath ? Number(databasePath) : 0,
    tls: parsed.protocol === "rediss:" ? {} : undefined,
    maxRetriesPerRequest: role === "worker" ? null : 1,
  };
}
