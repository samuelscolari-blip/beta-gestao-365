import { readFile, writeFile } from "node:fs/promises";

async function read(path) {
  return readFile(path, "utf8");
}

async function writeWhenChanged(path, previous, next) {
  if (previous === next) return false;
  await writeFile(path, next, "utf8");
  console.log(`Atualizado: ${path}`);
  return true;
}

function replaceOnce(text, search, replacement, description) {
  const occurrences = text.split(search).length - 1;
  if (occurrences !== 1) {
    throw new Error(
      `${description}: esperado exatamente 1 ponto de alteração, encontrado ${occurrences}.`,
    );
  }
  return text.replace(search, replacement);
}

let changed = false;

const modulesPath = "app/lib/modules.ts";
const modulesSource = await read(modulesPath);
const legacyOption = '  "Vence em 7 dias",\n';
const modulesNext = modulesSource.includes(legacyOption)
  ? modulesSource.replace(legacyOption, "")
  : modulesSource;
changed = (await writeWhenChanged(modulesPath, modulesSource, modulesNext)) || changed;

const demoPath = "db/demo-records.ts";
const demoSource = await read(demoPath);
const demoNext = demoSource.replaceAll('"Vence em 7 dias"', '"Pendente"');
changed = (await writeWhenChanged(demoPath, demoSource, demoNext)) || changed;

const recordsPath = "db/records.ts";
const recordsSource = await read(recordsPath);
let recordsNext = recordsSource;

if (!recordsNext.includes("const pendingStatusBackfills")) {
  recordsNext = replaceOnce(
    recordsNext,
    "SELECT id, module, reference, payload, source FROM records",
    "SELECT id, module, reference, status, payload, source FROM records",
    "Consulta dos registros de demonstração",
  );

  recordsNext = replaceOnce(
    recordsNext,
    `      reference: string;\n      payload: string;\n      source: string;\n`,
    `      reference: string;\n      status: string;\n      payload: string;\n      source: string;\n`,
    "Tipo dos registros de demonstração",
  );

  const marker = `    }>();\n\n  const demoWorkerCounts = new Map(\n`;
  const migration = `    }>();\n\n  const pendingStatusBackfills = (existing.results || []).flatMap((row) => {\n    let payload: Record<string, unknown> = {};\n    try {\n      payload = JSON.parse(row.payload || \"{}\") as Record<string, unknown>;\n    } catch {\n      payload = {};\n    }\n    const topLevelUsesLegacyStatus = row.status === \"Vence em 7 dias\";\n    const payloadUsesLegacyStatus =\n      String(payload.status || \"\") === \"Vence em 7 dias\";\n    if (!topLevelUsesLegacyStatus && !payloadUsesLegacyStatus) return [];\n    return [{\n      id: row.id,\n      module: row.module,\n      payload: { ...payload, status: \"Pendente\" },\n    }];\n  });\n\n  if (pendingStatusBackfills.length) {\n    const updatedAt = new Date().toISOString();\n    await db.batch(\n      pendingStatusBackfills.map((record) =>\n        db\n          .prepare(\n            \\`UPDATE records\n             SET status = ?, payload = ?, updated_at = ?\n             WHERE tenant_id = ? AND id = ? AND source = ?\\`,\n          )\n          .bind(\n            \"Pendente\",\n            JSON.stringify(record.payload),\n            updatedAt,\n            DEFAULT_TENANT_ID,\n            record.id,\n            DEMO_SOURCE,\n          ),\n      ),\n    );\n    for (const record of pendingStatusBackfills) {\n      await audit(\n        \"DEMO_REFRESH\",\n        record.module,\n        record.id,\n        \"Situação fictícia padronizada como Pendente\",\n        \"Sistema\",\n      );\n    }\n  }\n\n  const demoWorkerCounts = new Map(\n`;

  recordsNext = replaceOnce(
    recordsNext,
    marker,
    migration,
    "Migração automática do status pendente",
  );
}

changed = (await writeWhenChanged(recordsPath, recordsSource, recordsNext)) || changed;

if (!changed) {
  console.log("Situação Pendente já está normalizada.");
}
