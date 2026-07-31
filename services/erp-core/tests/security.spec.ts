import assert from "node:assert/strict";
import test from "node:test";
import { resetConfigForTests } from "../src/config/env";
import { EncryptedPayloadService } from "../src/security/encrypted-payload.service";
import {
  canonicalizeRequest,
  createServiceSignature,
  signaturesMatch,
  timestampIsFresh,
} from "../src/security/service-signature";

function configureTestEnvironment() {
  process.env.DATABASE_URL = "postgres://test:test@localhost:5432/test";
  process.env.REDIS_URL = "redis://localhost:6379";
  process.env.ERP_SERVICE_CLIENT_ID = "test-client";
  process.env.ERP_SERVICE_HMAC_SECRET = "s".repeat(48);
  process.env.PAYLOAD_ENCRYPTION_KEY_BASE64 =
    Buffer.alloc(32, 7).toString("base64");
  process.env.CERTIFICATE_PROVIDER = "DISABLED";
  resetConfigForTests();
}

test("a assinatura HMAC cobre tenant, ator, rota, corpo e idempotência", () => {
  const input = {
    timestamp: new Date().toISOString(),
    method: "POST",
    pathWithQuery: "/v1/payroll/runs?dry=false",
    tenantId: "8b6f6f46-8d0c-4c2b-9db2-325830bd3060",
    actor: "admin@beta.example",
    idempotencyKey: "payroll-2026-07-0001",
    body: Buffer.from('{"competence":"2026-07"}'),
  };
  const secret = "h".repeat(48);
  const signature = createServiceSignature(input, secret);

  assert.equal(signaturesMatch(signature, signature), true);
  assert.notEqual(
    signature,
    createServiceSignature(
      { ...input, body: Buffer.from('{"competence":"2026-08"}') },
      secret,
    ),
  );
  assert.match(canonicalizeRequest(input), /payroll-2026-07-0001/);
  assert.equal(timestampIsFresh(input.timestamp), true);
  assert.equal(
    timestampIsFresh(new Date(Date.now() - 10 * 60_000).toISOString()),
    false,
  );
});

test("AES-256-GCM recupera o conteúdo e rejeita alteração", () => {
  configureTestEnvironment();
  const encryption = new EncryptedPayloadService();
  const plaintext =
    "<eSocial><evt Id=\"evt-1\">conteúdo protegido</evt></eSocial>";
  const encrypted = encryption.encrypt(plaintext);

  assert.notEqual(encrypted.ciphertext, plaintext);
  assert.equal(encryption.decrypt(encrypted), plaintext);
  assert.throws(() =>
    encryption.decrypt({
      ...encrypted,
      tag: Buffer.alloc(16, 0).toString("base64"),
    }),
  );
});
