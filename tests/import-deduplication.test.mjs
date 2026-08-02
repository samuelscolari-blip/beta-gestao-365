import assert from "node:assert/strict";
import test from "node:test";
import { buildImportDeduplicationKey } from "../app/lib/import-deduplication.mjs";

function record(overrides = {}) {
  return {
    module: "food",
    title: "Alimentação",
    reference: "",
    recordDate: "2026-08-02",
    amount: 60.2,
    source: "Planilha: custos.xlsx / ALIMENTACAO",
    payload: {
      description: "Alimentação",
      employeeName: "Matheus",
      work: "Obra Central",
      date: "2026-08-02",
      totalAmount: 60.2,
    },
    ...overrides,
  };
}

test("mesmo valor para Matheus e Carlos não é duplicidade", () => {
  const matheus = record();
  const carlos = record({
    payload: {
      ...record().payload,
      employeeName: "Carlos",
    },
  });

  assert.notEqual(
    buildImportDeduplicationKey(matheus),
    buildImportDeduplicationKey(carlos),
  );
});

test("mesmo valor com fornecedor, obra ou descrição diferente não é duplicidade", () => {
  const original = record();
  const outraObra = record({
    payload: {
      ...record().payload,
      work: "Obra Norte",
    },
  });

  assert.notEqual(
    buildImportDeduplicationKey(original),
    buildImportDeduplicationKey(outraObra),
  );
});

test("linha integralmente idêntica na mesma aba recebe a mesma chave", () => {
  const first = record();
  const repeated = record({ payload: { ...record().payload } });

  assert.equal(
    buildImportDeduplicationKey(first),
    buildImportDeduplicationKey(repeated),
  );
});

test("linha sem referência é preservada quando aparece em outra aba", () => {
  const first = record();
  const otherSheet = record({
    source: "Planilha: custos.xlsx / REEMBOLSOS",
  });

  assert.notEqual(
    buildImportDeduplicationKey(first),
    buildImportDeduplicationKey(otherSheet),
  );
});

test("mesma referência única é duplicidade mesmo em abas diferentes", () => {
  const first = record({
    reference: "DOC-2026-001",
  });
  const otherSheet = record({
    reference: "DOC-2026-001",
    source: "Planilha: custos.xlsx / REEMBOLSOS",
    payload: {
      ...record().payload,
      employeeName: "Carlos",
    },
  });

  assert.equal(
    buildImportDeduplicationKey(first),
    buildImportDeduplicationKey(otherSheet),
  );
});
