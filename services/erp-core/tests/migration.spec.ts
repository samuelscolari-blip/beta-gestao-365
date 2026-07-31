import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

test("as migrações protegem tenant, auditoria e lotes de folha", async () => {
  const coreMigration = await readFile(
    path.resolve(process.cwd(), "migrations/0001_core.sql"),
    "utf8",
  );
  const payrollMigration = await readFile(
    path.resolve(process.cwd(), "migrations/0002_payroll_parallel.sql"),
    "utf8",
  );
  const migration = `${coreMigration}\n${payrollMigration}`;

  assert.match(migration, /ENABLE ROW LEVEL SECURITY/i);
  assert.match(migration, /FORCE ROW LEVEL SECURITY/i);
  assert.match(migration, /CREATE POLICY tenant_isolation/i);
  assert.match(migration, /audit_events_no_update/i);
  assert.match(migration, /audit_events_no_delete/i);
  assert.match(migration, /payload_ciphertext/i);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS payroll_chunks/i);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS payroll_run_inputs/i);
  assert.match(migration, /payroll_items_run_tenant_fk/i);
  assert.match(migration, /current_setting\('app\.tenant_id'/i);
  assert.doesNotMatch(migration, /app\.current_tenant_id/i);
  assert.doesNotMatch(migration, /CERTIFICATE_PFX_PASSWORD\s*=/i);
});
