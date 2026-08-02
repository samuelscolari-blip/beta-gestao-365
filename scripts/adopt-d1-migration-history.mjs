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
const currentMigrationName = "0007_clever_daredevil.sql";

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

export const requiredV61Schema = [
  "table:importacoes",
  "table:importacao_erros",
  "column:importacoes:id",
  "column:importacoes:tenant_id",
  "column:importacoes:nome_arquivo",
  "column:importacoes:url_arquivo",
  "column:importacoes:modulo_destino",
  "column:importacoes:status",
  "column:importacoes:total_linhas",
  "column:importacoes:total_sucesso",
  "column:importacoes:total_atualizados",
  "column:importacoes:total_ignorados",
  "column:importacoes:total_erros",
  "column:importacoes:responsavel",
  "column:importacoes:iniciado_em",
  "column:importacoes:finalizado_em",
  "column:importacoes:criado_em",
  "column:importacao_erros:id",
  "column:importacao_erros:tenant_id",
  "column:importacao_erros:importacao_id",
  "column:importacao_erros:linha",
  "column:importacao_erros:aba",
  "column:importacao_erros:modulo",
  "column:importacao_erros:payload",
  "column:importacao_erros:motivo",
  "column:importacao_erros:resolvido",
  "column:importacao_erros:resolvido_por",
  "column:importacao_erros:resolvido_em",
  "column:importacao_erros:criado_em",
  "column:records:import_key",
  "index:importacoes_tenant_data_idx",
  "index:importacoes_tenant_status_idx",
  "index:importacao_erros_busca",
  "index:records_tenant_module_import_key_unique",
];

export function missingV61Schema(inventory) {
  return requiredV61Schema.filter((requirement) => !inventory.has(requirement));
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
  SELECT 'importacoes' AS table_name, name FROM pragma_table_info('importacoes');
  SELECT 'importacao_erros' AS table_name, name FROM pragma_table_info('importacao_erros');
`;

function readInventory() {
  return inventoryFromResults(runRemoteSql(inventorySql));
}

const reconcileLegacySql = `
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

const createV61TablesSql = `
  CREATE TABLE IF NOT EXISTS importacoes(
    id text PRIMARY KEY NOT NULL,
    tenant_id text DEFAULT 'beta-construtora' NOT NULL,
    nome_arquivo text NOT NULL,
    url_arquivo text DEFAULT '' NOT NULL,
    modulo_destino text DEFAULT '' NOT NULL,
    status text DEFAULT 'Pendente' NOT NULL,
    total_linhas integer DEFAULT 0 NOT NULL,
    total_sucesso integer DEFAULT 0 NOT NULL,
    total_atualizados integer DEFAULT 0 NOT NULL,
    total_ignorados integer DEFAULT 0 NOT NULL,
    total_erros integer DEFAULT 0 NOT NULL,
    responsavel text DEFAULT '' NOT NULL,
    iniciado_em text DEFAULT '' NOT NULL,
    finalizado_em text DEFAULT '' NOT NULL,
    criado_em text DEFAULT CURRENT_TIMESTAMP NOT NULL
  );

  CREATE TABLE IF NOT EXISTS importacao_erros(
    id text PRIMARY KEY NOT NULL,
    tenant_id text DEFAULT 'beta-construtora' NOT NULL,
    importacao_id text NOT NULL,
    linha integer NOT NULL,
    aba text DEFAULT '' NOT NULL,
    modulo text DEFAULT '' NOT NULL,
    payload text DEFAULT '{}' NOT NULL,
    motivo text NOT NULL,
    resolvido integer DEFAULT false NOT NULL,
    resolvido_por text DEFAULT '' NOT NULL,
    resolvido_em text DEFAULT '' NOT NULL,
    criado_em text DEFAULT CURRENT_TIMESTAMP NOT NULL,
    FOREIGN KEY (importacao_id) REFERENCES importacoes(id) ON UPDATE no action ON DELETE cascade
  );
`;

const v61CoreSchema = [
  "column:importacoes:id",
  "column:importacoes:nome_arquivo",
  "column:importacao_erros:id",
  "column:importacao_erros:importacao_id",
  "column:importacao_erros:linha",
  "column:importacao_erros:payload",
  "column:importacao_erros:motivo",
];

const additiveV61Columns = [
  ["importacoes", "tenant_id", "text DEFAULT 'beta-construtora' NOT NULL"],
  ["importacoes", "url_arquivo", "text DEFAULT '' NOT NULL"],
  ["importacoes", "modulo_destino", "text DEFAULT '' NOT NULL"],
  ["importacoes", "status", "text DEFAULT 'Pendente' NOT NULL"],
  ["importacoes", "total_linhas", "integer DEFAULT 0 NOT NULL"],
  ["importacoes", "total_sucesso", "integer DEFAULT 0 NOT NULL"],
  ["importacoes", "total_atualizados", "integer DEFAULT 0 NOT NULL"],
  ["importacoes", "total_ignorados", "integer DEFAULT 0 NOT NULL"],
  ["importacoes", "total_erros", "integer DEFAULT 0 NOT NULL"],
  ["importacoes", "responsavel", "text DEFAULT '' NOT NULL"],
  ["importacoes", "iniciado_em", "text DEFAULT '' NOT NULL"],
  ["importacoes", "finalizado_em", "text DEFAULT '' NOT NULL"],
  ["importacoes", "criado_em", "text DEFAULT '' NOT NULL"],
  ["importacao_erros", "tenant_id", "text DEFAULT 'beta-construtora' NOT NULL"],
  ["importacao_erros", "aba", "text DEFAULT '' NOT NULL"],
  ["importacao_erros", "modulo", "text DEFAULT '' NOT NULL"],
  ["importacao_erros", "resolvido", "integer DEFAULT false NOT NULL"],
  ["importacao_erros", "resolvido_por", "text DEFAULT '' NOT NULL"],
  ["importacao_erros", "resolvido_em", "text DEFAULT '' NOT NULL"],
  ["importacao_erros", "criado_em", "text DEFAULT '' NOT NULL"],
  ["records", "import_key", "text DEFAULT '' NOT NULL"],
];

export function missingColumnStatements(inventory) {
  return additiveV61Columns
    .filter(([table, column]) => !inventory.has(`column:${table}:${column}`))
    .map(
      ([table, column, definition]) =>
        `ALTER TABLE ${table} ADD ${column} ${definition};`,
    );
}

const reconcileV61IndexesSql = `
  CREATE INDEX IF NOT EXISTS importacoes_tenant_data_idx
    ON importacoes(tenant_id, criado_em);
  CREATE INDEX IF NOT EXISTS importacoes_tenant_status_idx
    ON importacoes(tenant_id, status);
  CREATE INDEX IF NOT EXISTS importacao_erros_busca
    ON importacao_erros(tenant_id, importacao_id)
    WHERE resolvido = 0;
  CREATE UNIQUE INDEX IF NOT EXISTS records_tenant_module_import_key_unique
    ON records(tenant_id, module, import_key)
    WHERE TRIM(import_key) <> '';
`;

export function main() {
  let inventory = readInventory();
  const missingLegacy = missingLegacySchema(inventory);
  if (missingLegacy.length) {
    throw new Error(
      "O banco remoto não contém todo o schema legado esperado; o histórico não foi alterado. " +
        `Itens ausentes: ${missingLegacy.join(", ")}`,
    );
  }

  runRemoteSql(reconcileLegacySql);
  console.log(
    `Histórico D1 reconciliado com segurança: ${legacyMigrationNames.length} migrations legadas reconhecidas.`,
  );

  runRemoteSql(createV61TablesSql);
  inventory = readInventory();
  const missingCore = v61CoreSchema.filter((item) => !inventory.has(item));
  if (missingCore.length) {
    throw new Error(
      "As tabelas de importação existentes são incompatíveis; nenhuma migration V61 foi registrada. " +
        `Itens essenciais ausentes: ${missingCore.join(", ")}`,
    );
  }

  const alterations = missingColumnStatements(inventory);
  if (alterations.length) runRemoteSql(alterations.join("\n"));
  runRemoteSql(reconcileV61IndexesSql);

  inventory = readInventory();
  const missingV61 = missingV61Schema(inventory);
  if (missingV61.length) {
    throw new Error(
      "O schema V61 não pôde ser reconciliado por completo; seu histórico não foi registrado. " +
        `Itens ausentes: ${missingV61.join(", ")}`,
    );
  }

  runRemoteSql(
    `INSERT OR IGNORE INTO d1_migrations(name) VALUES ('${currentMigrationName}');`,
  );
  console.log("Schema e histórico da migration V61 reconciliados com segurança.");
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main();
}
