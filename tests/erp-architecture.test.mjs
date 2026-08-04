import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("keeps every persistent record scoped to the company tenant", async () => {
  const store = await readFile(
    new URL("../db/records.ts", import.meta.url),
    "utf8",
  );
  const schema = await readFile(
    new URL("../db/schema.ts", import.meta.url),
    "utf8",
  );

  assert.match(store, /DEFAULT_TENANT_ID = "beta-construtora"/);
  assert.match(store, /conditions\.push\("tenant_id = \?"\)/);
  assert.match(store, /WHERE tenant_id = \? AND id = \?/);
  assert.match(store, /records_tenant_module_reference_unique/);
  assert.match(schema, /export const tenants/);
  assert.match(schema, /tenantId: text\("tenant_id"\)/);
});

test("seals the append-only audit trail with a hash chain", async () => {
  const store = await readFile(
    new URL("../db/records.ts", import.meta.url),
    "utf8",
  );
  const migration = await readFile(
    new URL("../drizzle/0003_last_captain_midlands.sql", import.meta.url),
    "utf8",
  );

  assert.match(store, /crypto\.subtle\.digest\("SHA-256"/);
  assert.match(store, /previous_hash/);
  assert.match(store, /entry_hash/);
  assert.match(migration, /audit_logs_immutable_update/);
  assert.match(migration, /audit_logs_immutable_delete/);
});

test("exposes construction, compliance and rule-engine bounded contexts", async () => {
  const modules = await readFile(
    new URL("../app/lib/modules.ts", import.meta.url),
    "utf8",
  );
  const capabilities = await readFile(
    new URL("../app/lib/erp-capabilities.ts", import.meta.url),
    "utf8",
  );
  const component = await readFile(
    new URL("../app/components/BetaApp.tsx", import.meta.url),
    "utf8",
  );

  assert.match(modules, /id: "works"/);
  assert.match(modules, /id: "compliance"/);
  assert.match(modules, /id: "rules"/);
  assert.match(modules, /key: "cno"/);
  assert.match(capabilities, /READY_FOR_CONNECTOR/);
  assert.match(component, /Central Fiscal & Compliance/);
  assert.match(component, /Preparação não é transmissão oficial/);
});

test("runs registered employees through a server-authoritative payroll batch", async () => {
  const route = await readFile(
    new URL("../app/api/payroll-preview/route.ts", import.meta.url),
    "utf8",
  );
  const component = await readFile(
    new URL("../app/components/BetaApp.tsx", import.meta.url),
    "utf8",
  );

  assert.match(route, /registeredBatch/);
  assert.match(route, /await listRecords\("people"\)/);
  assert.match(route, /resultHash/);
  assert.match(route, /Motor server-side de folha em lote/);
  assert.match(component, /Folha em lote por competência e obra/);
  assert.match(component, /Calcular e registrar lote/);
});

test("tracks machine maintenance, downtime loss and payment state", async () => {
  const modules = await readFile(
    new URL("../app/lib/modules.ts", import.meta.url),
    "utf8",
  );
  const store = await readFile(
    new URL("../db/records.ts", import.meta.url),
    "utf8",
  );
  const validation = await readFile(
    new URL("../app/lib/record-validation.ts", import.meta.url),
    "utf8",
  );
  const component = await readFile(
    new URL("../app/components/BetaApp.tsx", import.meta.url),
    "utf8",
  );

  assert.match(modules, /id: "asset_events"/);
  assert.match(modules, /key: "estimatedDowntimeLoss"/);
  assert.match(modules, /key: "paymentStatus"/);
  assert.match(store, /hydrateNewAssetEvent/);
  assert.match(validation, /expectedDailyRate/);
  assert.match(component, /machineAssetCostForPeriod/);
  assert.match(component, /Custo, disponibilidade e manutenção/);
  assert.match(component, /PERDA POR OCIOSIDADE/);
});
