import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const databaseName = process.env.CLOUDFLARE_D1_DATABASE || "beta-gestao-365-db";
const wranglerConfig = process.env.CLOUDFLARE_WRANGLER_CONFIG || "wrangler.jsonc";
const locationFlag =
  process.env.CLOUDFLARE_D1_LOCATION === "local" ? "--local" : "--remote";
const wranglerBinary =
  process.platform === "win32"
    ? "node_modules/.bin/wrangler.cmd"
    : "node_modules/.bin/wrangler";

const legacyMigrationNames = [
  "0000_famous_young_avengers.sql",
  "0001_smooth_hairball.sql",
  "0002_exotic_sersi.sql",
  "0003_last_captain_midlands.sql",
  "0004_past_jack_flag.sql",
  "0005_tiny_luke_cage.sql",
  "0006_numerous_franklin_storm.sql",
];

export const requiredLegacySchema = [
  "table:audit_logs",
  "table:records",
  "table:tenants",
  "table:compliance_issues",
  "table:fiscal_documents",
  "table:fiscal_items",
  "table:ibs_cbs_adjustments",
  "table:ibs_cbs_assessments",
  "table:ibs_cbs_audit_logs",
  "table:ibs_cbs_configurations",
  "column:audit_logs:tenant_id",
  "column:audit_logs:previous_hash",
  "column:audit_logs:entry_hash",
  "column:records:amount_cents",
  "column:records:tenant_id",
  "column:fiscal_documents:due_date",
];

export function missingLegacySchema(inventory) {
  return requiredLegacySchema.filter((requirement) => !inventory.has(requirement));
}

function runRemoteSql(command) {
  const result = spawnSync(
    wranglerBinary,
    [
      "d1",
      "execute",
      databaseName,
      locationFlag,
      "--config",
      wranglerConfig,
      "--json",
      "--command",
      command,
    ],
    {
      encoding: "utf8",
      env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
      maxBuffer: 4 * 1024 * 1024,
    },
  );

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `Wrangler não conseguiu consultar o D1.\n${result.stderr || result.stdout}`,
    );
  }

  const output = result.stdout.trim();
  const jsonStart = output.indexOf("[");
  if (jsonStart < 0) {
    throw new Error(`Wrangler não retornou JSON válido.\n${output}`);
  }
  return JSON.parse(output.slice(jsonStart));
}

function inventoryFromResults(resultSets) {
  const inventory = new Set();
  for (const resultSet of resultSets) {
    for (const row of resultSet.results || []) {
      if (row.type && row.name) inventory.add(`${row.type}:${row.name}`);
      if (row.table_name && row.name) {
        inventory.add(`column:${row.table_name}:${row.name}`);
      }
    }
  }
  return inventory;
}

const inventorySql = `
  SELECT type, name
  FROM sqlite_master
  WHERE type IN ('table', 'index', 'trigger');
  SELECT 'audit_logs' AS table_name, name FROM pragma_table_info('audit_logs');
  SELECT 'records' AS table_name, name FROM pragma_table_info('records');
  SELECT 'fiscal_documents' AS table_name, name FROM pragma_table_info('fiscal_documents');
`;

const reconcileSql = `
  CREATE TABLE IF NOT EXISTS d1_migrations(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
  );

  CREATE INDEX IF NOT EXISTS audit_logs_module_idx ON audit_logs(module);
  CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs(created_at);
  CREATE INDEX IF NOT EXISTS audit_logs_record_idx ON audit_logs(record_id, created_at);
  CREATE INDEX IF NOT EXISTS audit_logs_tenant_created_idx ON audit_logs(tenant_id, created_at);
  CREATE INDEX IF NOT EXISTS records_module_idx ON records(module);
  CREATE INDEX IF NOT EXISTS records_module_status_idx ON records(module, status);
  CREATE INDEX IF NOT EXISTS records_record_date_idx ON records(record_date);
  CREATE INDEX IF NOT EXISTS records_module_date_idx ON records(module, record_date);
  CREATE INDEX IF NOT EXISTS records_reference_idx ON records(reference);
  CREATE INDEX IF NOT EXISTS records_tenant_module_idx ON records(tenant_id, module);
  CREATE INDEX IF NOT EXISTS records_tenant_reference_idx ON records(tenant_id, reference);
  CREATE UNIQUE INDEX IF NOT EXISTS records_tenant_module_reference_unique
    ON records(tenant_id, module, LOWER(TRIM(reference)))
    WHERE TRIM(reference) <> '';

  CREATE TRIGGER IF NOT EXISTS audit_logs_immutable_update
  BEFORE UPDATE ON audit_logs
  BEGIN
    SELECT RAISE(ABORT, 'AUDIT_LOG_IMMUTABLE');
  END;
  CREATE TRIGGER IF NOT EXISTS audit_logs_immutable_delete
  BEFORE DELETE ON audit_logs
  BEGIN
    SELECT RAISE(ABORT, 'AUDIT_LOG_IMMUTABLE');
  END;

  INSERT OR IGNORE INTO tenants(id, legal_name, trade_name, status)
  VALUES ('beta-construtora', 'Beta Construtora', 'Beta Construtora', 'ACTIVE');

  INSERT OR IGNORE INTO d1_migrations(name) VALUES
    ${legacyMigrationNames.map((name) => `('${name}')`).join(",\n    ")};
`;

export function main() {
  const inventory = inventoryFromResults(runRemoteSql(inventorySql));
  const missing = missingLegacySchema(inventory);
  if (missing.length) {
    throw new Error(
      "O banco remoto não contém todo o schema legado esperado; o histórico não foi alterado. " +
        `Itens ausentes: ${missing.join(", ")}`,
    );
  }

  runRemoteSql(reconcileSql);
  console.log(
    `Histórico D1 reconciliado com segurança: ${legacyMigrationNames.length} migrations legadas reconhecidas.`,
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main();
}
