import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile("app/page.tsx", "utf8");
const v65 = await readFile("app/components/SecureBetaAppV65.tsx", "utf8");
const v66 = await readFile("app/components/SecureBetaAppV66.tsx", "utf8");

test("V66 is the component served by the official page", () => {
  assert.match(page, /SecureBetaAppV66/);
  assert.doesNotMatch(page, /SecureBetaAppV65\s+from/);
});

test("Aprovados remains visible when Cloudflare Access does not identify the admin", () => {
  assert.match(v66, /!props\.isAdmin \? <ApprovedDecisionFallback \/>/);
  assert.match(v66, /data-v66-approved="overview"/);
  assert.match(v66, /data-v66-approved="tab"/);
  assert.match(v66, />\s*Aprovados <span>/);
});

test("approved decisions cover purchases, payments, cards and rentals", () => {
  assert.match(v66, /"purchases"/);
  assert.match(v66, /"expenses"/);
  assert.match(v66, /"cards"/);
  assert.match(v66, /"rentals"/);
  assert.match(v66, /rentals: "Aluguéis"/);
});

test("V66 preserves the V65 importer preflight and admin implementation", () => {
  assert.match(v66, /SecureBetaAppV65/);
  assert.match(v65, /inspectImportFileV65/);
  assert.match(v65, /ImportPreflightModal/);
});
