import assert from "node:assert/strict";
import test from "node:test";
import {
  expandSpreadsheetDateMatrix,
  transposeSpreadsheetRows,
} from "../app/lib/spreadsheet-layout.mjs";
import { buildImportDeduplicationKey } from "../app/lib/import-deduplication.mjs";

const matrixConfig = {
  titleField: "employeeName",
  dateField: "date",
  amountField: "totalAmount",
  fields: [
    { key: "employeeName", label: "Pessoa", aliases: ["Colaborador", "Nome"] },
    { key: "work", label: "Obra", aliases: ["Centro de custo"] },
    { key: "description", label: "Descrição", aliases: ["Histórico"] },
    { key: "status", label: "Status", aliases: [] },
  ],
};

function importedRecord(payload, source = "Planilha: custos.xlsx / CUSTOS") {
  return {
    module: "food",
    title: String(payload.employeeName || "Alimentação"),
    reference: "",
    recordDate: String(payload.date || ""),
    amount: Number(payload.totalAmount || 0),
    payload,
    source,
  };
}

test("a mesma pessoa com o mesmo valor na segunda terça e quarta gera três lançamentos", () => {
  const rows = [
    ["Pessoa", "Obra", "Descrição", "Status", "03/08/2026", "04/08/2026", "05/08/2026"],
    ["Matheus", "Obra Central", "Almoço", "Conferido", 60.2, 60.2, 60.2],
  ];

  const expanded = expandSpreadsheetDateMatrix(rows, matrixConfig);
  assert.equal(expanded.matched, true);
  assert.equal(expanded.payloadRows.length, 3);

  const keys = expanded.payloadRows.map(({ payload }) =>
    buildImportDeduplicationKey(importedRecord(payload)),
  );
  assert.equal(new Set(keys).size, 3);
  assert.deepEqual(
    expanded.payloadRows.map(({ payload }) => payload.date),
    ["2026-08-03", "2026-08-04", "2026-08-05"],
  );
});

test("matriz esparsa ou diagonal transforma cada célula preenchida em lançamento", () => {
  const rows = [
    ["Pessoa", "Obra", "Descrição", "Status", "03/08/2026", "04/08/2026", "05/08/2026"],
    ["Matheus", "Obra Central", "Almoço", "Conferido", 60.2, "", ""],
    ["Matheus", "Obra Central", "Almoço", "Conferido", "", 60.2, ""],
    ["Matheus", "Obra Central", "Almoço", "Conferido", "", "", 60.2],
  ];

  const expanded = expandSpreadsheetDateMatrix(rows, matrixConfig);
  assert.equal(expanded.payloadRows.length, 3);
  assert.deepEqual(
    expanded.payloadRows.map(({ payload }) => payload.date),
    ["2026-08-03", "2026-08-04", "2026-08-05"],
  );
});

test("Matheus e Carlos com o mesmo valor nos mesmos dias continuam distintos", () => {
  const rows = [
    ["Pessoa", "Obra", "Descrição", "Status", "03/08/2026", "04/08/2026"],
    ["Matheus", "Obra Central", "Almoço", "Conferido", 60.2, 60.2],
    ["Carlos", "Obra Central", "Almoço", "Conferido", 60.2, 60.2],
  ];

  const expanded = expandSpreadsheetDateMatrix(rows, matrixConfig);
  const keys = expanded.payloadRows.map(({ payload }) =>
    buildImportDeduplicationKey(importedRecord(payload)),
  );
  assert.equal(expanded.payloadRows.length, 4);
  assert.equal(new Set(keys).size, 4);
});

test("tabela horizontal pode ser transposta para o formato convencional", () => {
  const horizontal = [
    ["Pessoa", "Matheus", "Carlos"],
    ["Data", "03/08/2026", "03/08/2026"],
    ["Valor", 60.2, 60.2],
    ["Obra", "Obra Central", "Obra Central"],
  ];

  assert.deepEqual(transposeSpreadsheetRows(horizontal), [
    ["Pessoa", "Data", "Valor", "Obra"],
    ["Matheus", "03/08/2026", 60.2, "Obra Central"],
    ["Carlos", "03/08/2026", 60.2, "Obra Central"],
  ]);
});
