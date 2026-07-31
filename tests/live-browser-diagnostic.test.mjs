import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const script = await readFile(
  new URL("../scripts/live-browser-diagnostic.mjs", import.meta.url),
  "utf8",
);
const validationWorkflow = await readFile(
  new URL("../.github/workflows/validate-cloudflare.yml", import.meta.url),
  "utf8",
);
const diagnosticWorkflow = await readFile(
  new URL("../.github/workflows/live-browser-diagnostic.yml", import.meta.url),
  "utf8",
);
const packageJson = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8"),
);

test("live browser diagnostic requires a stable native WebSocket runtime", () => {
  assert.match(script, /Node\.js 22\.4\+ é necessário/);
  assert.match(script, /typeof WebSocket !== "function"/);
  assert.match(validationWorkflow, /node-version: 22\.19\.0/);
  assert.match(diagnosticWorkflow, /node-version: 22\.19\.0/);
  assert.equal(
    packageJson.scripts["diagnose:live"],
    "node scripts/live-browser-diagnostic.mjs",
  );
});

test("live browser diagnostic is bounded and cleans up Chrome resources", () => {
  assert.match(script, /server\.listen\(0, "127\.0\.0\.1"/);
  assert.match(script, /const controller = new AbortController\(\)/);
  assert.match(script, /finally \{\s*clearTimeout\(timeoutId\)/);
  assert.match(script, /await terminate\(chrome\)/);
  assert.match(script, /rejectWaiters\(new Error\("Diagnóstico encerrado\."\)\)/);
  assert.match(script, /__beta_diagnostic/);
});

test("diagnostic reports loading, APIs, console and network failures", () => {
  assert.match(script, /RECORDS_PROBE/);
  assert.match(script, /TAX_PROBE/);
  assert.match(script, /EXCEPTIONS/);
  assert.match(script, /FAILED/);
  assert.match(script, /PENDING/);
  assert.match(script, /Spinner persistiu/);
  assert.match(script, /chrome-error:\/\//);
});
