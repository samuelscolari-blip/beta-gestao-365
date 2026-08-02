import { readFileSync, writeFileSync, rmSync } from "node:fs";

// Correção final isolada e idempotente: restaura a limpeza após qualquer tentativa.
const appPath = "app/components/BetaApp.tsx";
let app = readFileSync(appPath, "utf8");
const before = `    } catch (error) {\n      setToast({\n        kind: "error",\n        text: error instanceof Error ? error.message : "Não foi possível importar a planilha.",\n      });\n    }\n  }\n\n  const displayName =`;
const after = `    } catch (error) {\n      setToast({\n        kind: "error",\n        text: error instanceof Error ? error.message : "Não foi possível importar a planilha.",\n      });\n    } finally {\n      if (fileInput.current) fileInput.current.value = "";\n      setImportTarget(undefined);\n    }\n  }\n\n  const displayName =`;
if (!app.includes(before)) {
  throw new Error("V60: função handleImport não corresponde à versão validada");
}
app = app.replace(before, after);
writeFileSync(appPath, app, "utf8");

const testPath = "tests/v60-improvements.test.mjs";
let tests = readFileSync(testPath, "utf8");
const marker = `  assert.match(app, /batchSize = 250/);\n  assert.doesNotMatch(spreadsheet, /csv-parser|bullmq|createReadStream/);`;
const replacement = `  assert.match(app, /batchSize = 250/);\n  assert.match(app, /finally \\{[\\s\\S]*fileInput\\.current\\.value = "";[\\s\\S]*setImportTarget\\(undefined\\)/);\n  assert.doesNotMatch(spreadsheet, /csv-parser|bullmq|createReadStream/);`;
if (!tests.includes(marker)) {
  throw new Error("V60: marcador do teste de importação não encontrado");
}
tests = tests.replace(marker, replacement);
writeFileSync(testPath, tests, "utf8");

rmSync("scripts/fix-v60-import-finally.mjs", { force: true });
rmSync(".github/workflows/fix-v60-import-finally.yml", { force: true });
