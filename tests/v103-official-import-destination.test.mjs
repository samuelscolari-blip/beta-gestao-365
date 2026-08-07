import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const preflight = await readFile("app/lib/import-preflight-v65.ts", "utf8");
const modules = await readFile("app/lib/modules.ts", "utf8");

test("03_COLABORADORES pertence somente ao Cadastro de Funcionários", () => {
  const peopleBlock = modules.match(
    /id: "people"[\s\S]*?spreadsheetSheets: \["03_COLABORADORES"\]/,
  );
  assert.ok(peopleBlock, "A aba oficial de colaboradores perdeu o vínculo com people.");
});

test("pré-validação trata nome oficial da aba como destino declarado", () => {
  assert.match(preflight, /function declaredModuleForSheet\(sheetName: string\)/);
  assert.match(preflight, /module\.spreadsheetSheets\.some/);
  assert.match(preflight, /const declaredModule = declaredModuleForSheet\(sheet\.sheet\)/);
  assert.match(preflight, /if \(declaredModule\) \{/);
  assert.match(preflight, /parseModuleSheet\(\s*declaredModule,/s);
  assert.match(preflight, /destino fixado pelo nome oficial da aba/);
});

test("aba oficial inválida é recusada e não redirecionada para outro módulo", () => {
  const declaredBranch = preflight.slice(
    preflight.indexOf("if (declaredModule)"),
    preflight.indexOf("const resolution = resolveImportSheet"),
  );
  assert.match(declaredBranch, /if \(!parsed\.records\.length\)/);
  assert.match(declaredBranch, /unrecognized\.push/);
  assert.match(declaredBranch, /continue;/);
  assert.doesNotMatch(declaredBranch, /resolveImportSheet/);
});
