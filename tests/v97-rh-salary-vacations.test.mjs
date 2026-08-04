import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const wrapperPath = new URL(
  "../app/components/SecureBetaAppV97.tsx",
  import.meta.url,
);
const pagePath = new URL("../app/page.tsx", import.meta.url);

test("a aplicação ativa a estrutura V97 do Administrativo e RH", async () => {
  const page = await readFile(pagePath, "utf8");

  assert.match(page, /SecureBetaAppV97/);
  assert.doesNotMatch(page, /SecureBetaAppV66\s+from/);
});

test("Cálculo de Folha passa a se chamar Cálculo de Salário", async () => {
  const source = await readFile(wrapperPath, "utf8");

  assert.match(source, /label:\s*"Cálculo de Salário"/);
  assert.match(source, /shortLabel:\s*"Cálculo de Salário"/);
  assert.match(
    source,
    /replaceAll\([\s\S]*"Cálculo de Folha"[\s\S]*"Cálculo de Salário"/,
  );
});

test("Cálculo de Férias possui tela separada no grupo de RH", async () => {
  const source = await readFile(wrapperPath, "utf8");

  assert.match(source, /id:\s*"vacations"/);
  assert.match(source, /label:\s*"Cálculo de Férias"/);
  assert.match(source, /rhGroup\.items\.splice/);
  assert.match(source, /moduleMap\.vacations/);
});

test("a aba de férias fica sempre entre salário e rescisão", async () => {
  const source = await readFile(wrapperPath, "utf8");

  assert.match(source, /orderedItems\.filter\(\(item\) => item !== "vacations"\)/);
  assert.match(source, /orderedItems\.indexOf\("payroll"\)/);
  assert.match(source, /orderedItems\.indexOf\("terminations"\)/);
  assert.match(source, /orderedItems\.splice\(insertionIndex, 0, "vacations"\)/);
  assert.match(source, /ensureRhStructure\(\);[\s\S]*return <SecureBetaAppV66/);
});

test("a etapa não implementa fórmulas de férias antecipadamente", async () => {
  const source = await readFile(wrapperPath, "utf8");

  assert.doesNotMatch(
    source,
    /calculateVacation|calcularFerias|INSS.*férias|IRRF.*férias/i,
  );
  assert.match(
    source,
    /O cálculo será integrado aos dados salariais na próxima etapa/,
  );
});
