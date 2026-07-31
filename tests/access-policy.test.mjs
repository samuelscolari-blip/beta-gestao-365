import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("public page identifies read-only mode without exposing the administrator", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("access-test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  const response = await worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );

  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /Modo público de demonstração/i);
  assert.match(html, /Entrar como administrador/i);
  assert.doesNotMatch(html, /scolarisamuel@gmail\.com/i);
  assert.doesNotMatch(html, /Samuel Scolari/i);
});

test("anonymous writes are rejected before reaching the database", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("write-test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const environment = {
    ASSETS: {
      fetch: async () => new Response("Not found", { status: 404 }),
    },
  };
  const context = {
    waitUntil() {},
    passThroughOnException() {},
  };

  const recordsResponse = await worker.fetch(
    new Request("http://localhost/api/records", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        record: {
          module: "expenses",
          title: "Tentativa pública",
          reference: "SECURITY-TEST",
          recordDate: "2026-07-27",
          amount: 1,
          payload: {},
        },
      }),
    }),
    environment,
    context,
  );
  assert.equal(recordsResponse.status, 401);
  assert.equal((await recordsResponse.json()).code, "ADMIN_REQUIRED");

  const taxResponse = await worker.fetch(
    new Request("http://localhost/api/tax-profile", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ taxRegime: "Lucro Real" }),
    }),
    environment,
    context,
  );
  assert.equal(taxResponse.status, 401);
  assert.equal((await taxResponse.json()).code, "ADMIN_REQUIRED");

  const payrollResponse = await worker.fetch(
    new Request("http://localhost/api/payroll-preview", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        input: {
          employeeName: "Tentativa pública",
          competence: "2026-07",
          baseSalary: 3000,
        },
      }),
    }),
    environment,
    context,
  );
  assert.equal(payrollResponse.status, 401);
  assert.equal((await payrollResponse.json()).code, "ADMIN_REQUIRED");

  const terminationResponse = await worker.fetch(
    new Request("http://localhost/api/termination-preview", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        input: {
          employeeRecordId: 1,
          terminationDate: "2026-07-28",
        },
      }),
    }),
    environment,
    context,
  );
  assert.equal(terminationResponse.status, 401);
  assert.equal(
    (await terminationResponse.json()).code,
    "ADMIN_REQUIRED",
  );
});

test("mutation routes keep server-side authorization and integrity guards", async () => {
  const recordsRoute = await readFile(
    new URL("../app/api/records/route.ts", import.meta.url),
    "utf8",
  );
  const taxRoute = await readFile(
    new URL("../app/api/tax-profile/route.ts", import.meta.url),
    "utf8",
  );
  const payrollRoute = await readFile(
    new URL("../app/api/payroll-preview/route.ts", import.meta.url),
    "utf8",
  );
  const terminationRoute = await readFile(
    new URL("../app/api/termination-preview/route.ts", import.meta.url),
    "utf8",
  );
  const store = await readFile(
    new URL("../db/records.ts", import.meta.url),
    "utf8",
  );

  assert.equal(
    (recordsRoute.match(/requireSoleAdmin\(request\)/g) || []).length,
    3,
    "POST, PUT and DELETE must all enforce the administrator",
  );
  assert.match(taxRoute, /requireSoleAdmin\(request\)/);
  assert.match(payrollRoute, /requireSoleAdmin\(request\)/);
  assert.match(payrollRoute, /calculatePayroll\(input\)/);
  assert.match(payrollRoute, /colaboradoresList/);
  assert.match(terminationRoute, /requireSoleAdmin\(request\)/);
  assert.match(terminationRoute, /calculateTermination\(input\)/);
  assert.match(terminationRoute, /await Promise\.all/);
  assert.match(terminationRoute, /Nenhum dado foi transmitido/);
  assert.match(store, /DUPLICATE_REFERENCE/);
  assert.match(store, /STALE_RECORD/);
  assert.match(store, /PAYLOAD_TOO_LARGE/);
  assert.match(store, /audit_logs_record_idx/);
  assert.match(store, /export async function queryRecords/);
});
