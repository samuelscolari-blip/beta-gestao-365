import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const records = await readFile(
  path.join(process.cwd(), "db", "records.ts"),
  "utf8",
);
const createMany = records.slice(
  records.indexOf("export async function createMany"),
  records.indexOf("function nonNegativeInteger"),
);

test("a importação carrega o diretório existente de pessoas antes de casar CPF ou nome", () => {
  const preload = createMany.indexOf('if (moduleId === "people")');
  const cpfIndex = createMany.indexOf("const existingByCpf");
  const nameIndex = createMany.indexOf("const existingByName");

  assert.ok(preload >= 0, "faltou carregar o cadastro de pessoas");
  assert.ok(preload < cpfIndex, "o cadastro precisa existir antes do índice por CPF");
  assert.ok(preload < nameIndex, "o cadastro precisa existir antes do índice por nome");
  assert.match(
    createMany,
    /if \(moduleId === "people"\)[\s\S]*SELECT \$\{selectColumns\} FROM records[\s\S]*WHERE tenant_id = \? AND module = \?/,
  );
});

test("duas linhas do mesmo lote com o mesmo CPF não criam duas pessoas", () => {
  assert.match(createMany, /const seenBatchPeopleCpf = new Set<string>\(\)/);
  assert.match(
    createMany,
    /input\.module === "people" && cpfDaLinha\.length === 11/,
  );
  assert.match(
    createMany,
    /seenBatchPeopleCpf\.has\(peopleCpfBatchKey\)[\s\S]*skipped \+= 1;[\s\S]*continue;/,
  );
  assert.match(
    createMany,
    /seenBatchPeopleCpf\.add\(peopleCpfBatchKey\)/,
  );
});
