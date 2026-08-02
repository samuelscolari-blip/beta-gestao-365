import { readFileSync, writeFileSync, rmSync } from "node:fs";

const path = "app/lib/spreadsheet.ts";
let content = readFileSync(path, "utf8");

function replaceOnce(before, after, label) {
  if (!content.includes(before)) {
    throw new Error(`Deduplicação: marcador não encontrado em ${label}`);
  }
  content = content.replace(before, after);
}

replaceOnce(
  'import { validateRecordPayload } from "./record-validation";\n',
  'import { validateRecordPayload } from "./record-validation";\nimport { buildImportDeduplicationKey } from "./import-deduplication.mjs";\n',
  "importação do helper",
);

replaceOnce(
  'function importKey(record: ImportRecord) {\n  const reference = record.reference.trim().toLowerCase();\n  if (reference) return record.module + "::ref::" + reference;\n  return record.module + "::" + record.title.trim().toLowerCase() + "::" + record.recordDate + "::" + record.amount;\n}\n\n',
  '',
  "função antiga",
);

replaceOnce(
  '      const key = importKey(record);\n',
  '      const key = buildImportDeduplicationKey(record);\n',
  "uso da chave",
);

writeFileSync(path, content, "utf8");
rmSync("scripts/apply-import-deduplication-fix.mjs", { force: true });
rmSync(".github/workflows/apply-import-deduplication-fix.yml", { force: true });
