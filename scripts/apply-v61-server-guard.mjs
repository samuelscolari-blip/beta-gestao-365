import { readFileSync, writeFileSync, rmSync } from "node:fs";

const recordsPath = "db/records.ts";
let records = readFileSync(recordsPath, "utf8");

function replaceOnce(content, before, after, label) {
  if (!content.includes(before)) {
    throw new Error(`V61 server guard: marcador não encontrado em ${label}`);
  }
  return content.replace(before, after);
}

records = replaceOnce(
  records,
  'import { validateRecordPayload } from "../app/lib/record-validation";\n',
  'import { validateRecordPayload } from "../app/lib/record-validation";\nimport { isImportableModule } from "../app/lib/import-policy";\n',
  "import policy",
);

records = replaceOnce(
  records,
  `  const issues = validateRecordPayload(moduleId, payload);\n`,
  `  const source = cleanText(input.source || "system", 80);\n  if (source.startsWith("Planilha:") && !isImportableModule(moduleId)) {\n    throw new RecordStoreError(\n      "Este módulo não aceita dados importados por planilha. Use cadastro ou validação interna.",\n      "IMPORT_MODULE_NOT_ALLOWED",\n      403,\n    );\n  }\n  const issues = validateRecordPayload(moduleId, payload);\n`,
  "normalize input source guard",
);

records = replaceOnce(
  records,
  `    source: cleanText(input.source || "system", 80),\n`,
  `    source,\n`,
  "normalized source return",
);

writeFileSync(recordsPath, records, "utf8");

const testPath = "tests/v61-importer.test.mjs";
let tests = readFileSync(testPath, "utf8");
const marker = `const app = await readFile("app/components/BetaApp.tsx", "utf8");\n`;
tests = replaceOnce(
  tests,
  marker,
  marker + 'const recordsStore = await readFile("db/records.ts", "utf8");\n',
  "test records source",
);
const testMarker = `test("V61 informa família, orientação, confiança e erros na prévia", () => {`;
tests = replaceOnce(
  tests,
  testMarker,
  `test("V61 bloqueia planilhas proibidas também no servidor", () => {\n  assert.match(recordsStore, /source\\.startsWith\\("Planilha:"\\)/);\n  assert.match(recordsStore, /!isImportableModule\\(moduleId\\)/);\n  assert.match(recordsStore, /IMPORT_MODULE_NOT_ALLOWED/);\n});\n\n${testMarker}`,
  "server guard test",
);
writeFileSync(testPath, tests, "utf8");

rmSync("scripts/apply-v61-server-guard.mjs", { force: true });
rmSync(".github/workflows/apply-v61-server-guard.yml", { force: true });
