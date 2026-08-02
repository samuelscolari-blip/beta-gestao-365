import { readFileSync, writeFileSync, rmSync } from "node:fs";

const path = "app/components/BetaApp.tsx";
let content = readFileSync(path, "utf8");

function replaceOnce(before, after, label) {
  if (!content.includes(before)) {
    throw new Error(`V61: marcador não encontrado em ${label}`);
  }
  content = content.replace(before, after);
}

replaceOnce(
  `import {\n  exportAllWorkbook,\n  exportModuleWorkbook,\n  importWorkbook,\n} from "../lib/spreadsheet";\n`,
  `import {\n  exportAllWorkbook,\n  exportModuleWorkbook,\n  importWorkbook,\n} from "../lib/spreadsheet";\nimport {\n  importScopeDescription,\n  isImportableModule,\n} from "../lib/import-policy";\n`,
  "import policy",
);

content = content.replaceAll(
  "module.spreadsheetSheets.length",
  "isImportableModule(module.id)",
);

replaceOnce(
  `  function requestImport(moduleId?: string) {\n    if (!hasEditingAccess()) return;\n    setImportTarget(moduleId);\n    fileInput.current?.click();\n  }\n`,
  `  function requestImport(moduleId?: string) {\n    if (!hasEditingAccess()) return;\n    if (moduleId && !isImportableModule(moduleId)) {\n      setToast({\n        kind: "error",\n        text:\n          "Este módulo não aceita importação automática. O Importador Inteligente recebe somente " +\n          importScopeDescription,\n      });\n      return;\n    }\n    setImportTarget(moduleId);\n    fileInput.current?.click();\n  }\n`,
  "requestImport",
);

replaceOnce(
  `      const preview = imported.report\n        .map((item) =>\n          item.sheet + " → " + item.module + ": " + item.imported + " válidos, " + item.invalid + " inválidos, " + item.duplicates + " duplicados, " + item.skipped + " ignorados",\n        )\n        .join("\\n");\n`,
  `      const preview = imported.report\n        .map((item) => {\n          const errors = item.invalidExamples.length\n            ? "\\n  Pendências encontradas: " + item.invalidExamples.join(" | ")\n            : "";\n          return (\n            item.sheet +\n            " → " +\n            item.family +\n            " / " +\n            item.module +\n            " • " +\n            item.layout +\n            " • confiança " +\n            item.confidence +\n            "%: " +\n            item.imported +\n            " válidos, " +\n            item.invalid +\n            " inválidos, " +\n            item.duplicates +\n            " duplicados reais, " +\n            item.skipped +\n            " ignorados" +\n            errors\n          );\n        })\n        .join("\\n\\n");\n`,
  "import preview",
);

replaceOnce(
  `          <p>\n            O importador reconhece as abas da Central Operacional, converte os\n            registros para cada módulo e ignora as linhas demonstrativas.\n          </p>\n`,
  `          <p>\n            O Importador Inteligente aceita somente Custos, Máquinas e\n            Funcionários. Ele reconhece tabelas verticais, horizontais e\n            matrizes de datas, apresenta uma prévia e não grava linhas inválidas.\n          </p>\n`,
  "integration hero copy",
);

replaceOnce(
  `                  <Icon name="upload" size={18} /> Importar Central Operacional\n`,
  `                  <Icon name="upload" size={18} /> Importar Custos, Máquinas ou Funcionários\n`,
  "integration import button",
);

replaceOnce(
  `      detail: "Importação das planilhas e exportação do backup",\n`,
  `      detail: "Importador inteligente controlado para Custos, Máquinas e Funcionários",\n`,
  "excel service detail",
);

writeFileSync(path, content, "utf8");
rmSync("scripts/apply-v61-interface.mjs", { force: true });
rmSync(".github/workflows/apply-v61.yml", { force: true });
