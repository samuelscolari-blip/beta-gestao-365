import {
  createHash,
  createHmac,
  timingSafeEqual,
} from "node:crypto";

export type CanonicalRequest = {
  timestamp: string;
  method: string;
  pathWithQuery: string;
  tenantId: string;
  actor: string;
  idempotencyKey: string;
  body: Uint8Array;
};

export function sha256Hex(value: Uint8Array | string) {
  return createHash("sha256").update(value).digest("hex");
}

export function canonicalizeRequest(input: CanonicalRequest) {
  return [
    input.timestamp,
    input.method.toUpperCase(),
    input.pathWithQuery,
    input.tenantId,
    input.actor,
    input.idempotencyKey,
    sha256Hex(input.body),
  ].join("\n");
}

export function createServiceSignature(
  input: CanonicalRequest,
  secret: string,
) {
  return createHmac("sha256", secret)
    .update(canonicalizeRequest(input))
    .digest("base64url");
}

export function signaturesMatch(expected: string, received: string) {
  const left = Buffer.from(expected);
  const right = Buffer.from(received);
  return left.byteLength === right.byteLength && timingSafeEqual(left, right);
}

export function timestampIsFresh(
  timestamp: string,
  now = Date.now(),
  toleranceMs = 5 * 60 * 1000,
) {
  const parsed = Date.parse(timestamp);
  return Number.isFinite(parsed) && Math.abs(now - parsed) <= toleranceMs;
}
