import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const service = await readFile("worker/imports/import.service.ts", "utf8");

test("V63 diferencia importação concluída de importação concluída com erros", () => {
  assert.match(service, /progress\.invalidos > 0 \? 'Concluída com erros' : 'Concluída'/);
  assert.match(service, /Existem linhas rejeitadas para revisão/);
  assert.match(service, /Todas as linhas válidas foram processadas/);
});

test("V63 preserva streaming, lotes e registro de erros no D1 atual", () => {
  assert.match(service, /for await \(const parsed of parseCsvStream\(stream\)\)/);
  assert.match(service, /const BATCH_SIZE = 1000/);
  assert.match(service, /this\.repo\.bulkUpsert\(validos\)/);
  assert.match(service, /this\.repo\.registrarErros\(importId, erros\)/);
  assert.doesNotMatch(service, /node-postgres|pg-core|Hyperdrive|csv-parse/);
});
