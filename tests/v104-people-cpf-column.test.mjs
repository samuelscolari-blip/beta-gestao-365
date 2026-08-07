import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const enhancements = await readFile("app/lib/v65-module-enhancements.ts", "utf8");
const modules = await readFile("app/lib/modules.ts", "utf8");

test("CPF continua sendo um único campo da ficha oficial", () => {
  assert.match(modules, /\{ key: "cpf", label: "CPF", type: "text"/);
});

test("lista de funcionários exibe o CPF já salvo logo após o nome", () => {
  assert.match(enhancements, /function insertColumnAfter/);
  assert.match(enhancements, /insertColumnAfter\(moduleMap\.people, "cpf", "name"\)/);
});

test("a mudança visual não cria nem importa um segundo CPF", () => {
  const occurrences = (enhancements.match(/key: "cpf"/g) || []).length;
  assert.equal(occurrences, 0);
  assert.doesNotMatch(enhancements, /appendField\(moduleMap\.people,[\s\S]*key: "cpf"/);
});
