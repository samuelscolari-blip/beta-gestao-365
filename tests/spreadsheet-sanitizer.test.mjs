import assert from "node:assert/strict";
import test from "node:test";
import {
  sanitizeSpreadsheetDate,
  sanitizeSpreadsheetMoney,
} from "../app/lib/spreadsheet-sanitizer.mjs";
import {
  detectCsvDelimiter,
  parseCsvRows,
} from "../app/lib/spreadsheet-csv.mjs";

test("sanitizador aceita data serial, brasileira e ISO", () => {
  assert.equal(sanitizeSpreadsheetDate(46237), "2026-08-03");
  assert.equal(sanitizeSpreadsheetDate("03/08/2026"), "2026-08-03");
  assert.equal(sanitizeSpreadsheetDate("2026-08-03"), "2026-08-03");
});

test("sanitizador rejeita data ambígua ou inexistente", () => {
  assert.throws(() => sanitizeSpreadsheetDate(31), /Formato de data inválido/);
  assert.throws(() => sanitizeSpreadsheetDate("31/02/2026"), /Formato de data inválido/);
});

test("sanitizador monetário entende formatos brasileiro e internacional", () => {
  assert.equal(sanitizeSpreadsheetMoney("R$ 1.234,56"), 1234.56);
  assert.equal(sanitizeSpreadsheetMoney("USD 1,234.56"), 1234.56);
  assert.equal(sanitizeSpreadsheetMoney("60,20"), 60.2);
  assert.equal(sanitizeSpreadsheetMoney(60.2), 60.2);
});

test("sanitizador monetário não converte texto inválido em zero", () => {
  assert.throws(() => sanitizeSpreadsheetMoney("valor pendente"), /Formato monetário inválido/);
});

test("parser CSV detecta ponto e vírgula e preserva separador entre aspas", () => {
  const source = 'Código obra;Gestor;Observação\r\nOB-01;Samuel;"Prazo; revisado"';
  assert.equal(detectCsvDelimiter(source), ";");
  assert.deepEqual(parseCsvRows(source), [
    ["Código obra", "Gestor", "Observação"],
    ["OB-01", "Samuel", "Prazo; revisado"],
  ]);
});

test("parser CSV preserva quebra de linha e aspas escapadas", () => {
  const source = 'Código,Nota\nOB-02,"Linha 1\nLinha ""2"""';
  assert.deepEqual(parseCsvRows(source), [
    ["Código", "Nota"],
    ["OB-02", 'Linha 1\nLinha "2"'],
  ]);
});

