import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const worker = await readFile("worker/index.ts", "utf8");
const route = await readFile("worker/imports/import-worker.ts", "utf8");
const service = await readFile("worker/imports/import.service.ts", "utf8");
const parser = await readFile("worker/imports/csv-stream.ts", "utf8");
const repository = await readFile("worker/imports/obra.repository.ts", "utf8");
const types = await readFile("worker/imports/types.ts", "utf8");

test("V62 conecta produtor e consumidor sem substituir o Worker principal", () => {
  assert.match(worker, /handleImportRequest/);
  assert.match(worker, /processImportQueue/);
  assert.match(worker, /handler\.fetch\(authenticatedRequest, env, ctx\)/);
  assert.match(worker, /async queue\(/);
});

test("V62 exige identidade confiável e bindings antes de receber arquivos", () => {
  assert.match(route, /x-beta-authenticated-email/);
  assert.match(route, /Acesso não autenticado/);
  assert.match(route, /STORAGE_BUCKET/);
  assert.match(route, /IMPORT_QUEUE/);
  assert.match(route, /Importação assíncrona ainda não ativada/);
});

test("V62 grava no R2 e devolve 202 antes do processamento pesado", () => {
  assert.match(route, /STORAGE_BUCKET\.put/);
  assert.match(route, /IMPORT_QUEUE\.send/);
  assert.match(route, /status: 'Na fila'/);
  assert.match(route, /202/);
  assert.match(route, /MAX_FILE_SIZE/);
});

test("V62 processa CSV em streaming e mantém memória limitada por lotes", () => {
  assert.match(parser, /stream\.getReader\(\)/);
  assert.match(parser, /TextDecoder/);
  assert.match(parser, /async function\* parseCsvStream/);
  assert.match(service, /for await \(const parsed of parseCsvStream\(stream\)\)/);
  assert.match(service, /const BATCH_SIZE = 1000/);
  assert.match(service, /batchValidos = \[\]/);
  assert.match(service, /batchErros = \[\]/);
});

test("V62 usa D1 atual, upsert idempotente e registro de erros", () => {
  assert.match(repository, /constructor\([\s\S]*D1Database/);
  assert.match(repository, /MODULE_WORKS = 'works'/);
  assert.match(repository, /existingReferences/);
  assert.match(repository, /UPDATE records/);
  assert.match(repository, /INSERT INTO records/);
  assert.match(repository, /MODULE_IMPORT_ERRORS/);
  assert.match(repository, /buscarImportacao/);
});

test("V62 não introduz PostgreSQL, Hyperdrive ou parser incompatível", () => {
  const implementation = [worker, route, service, parser, repository, types].join("\n");
  assert.doesNotMatch(implementation, /from ['"]pg['"]|pg-format|Hyperdrive/);
  assert.doesNotMatch(implementation, /csv-parse/);
  assert.doesNotMatch(implementation, /request\.arrayBuffer\(\)|request\.text\(\)/);
});
