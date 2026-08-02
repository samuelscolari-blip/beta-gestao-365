import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const records = await readFile("db/records.ts", "utf8");
const schema = await readFile("db/schema.ts", "utf8");
const route = await readFile("app/api/records/route.ts", "utf8");
const app = await readFile("app/components/BetaApp.tsx", "utf8");
const modules = await readFile("app/lib/modules.ts", "utf8");

test("pipeline D1 mantém chave idempotente e bulk upsert parametrizado", () => {
  assert.match(records, /import_key/);
  assert.match(records, /buildImportDeduplicationKey/);
  assert.match(records, /crypto\.subtle\.digest/);
  assert.match(records, /UPDATE records/);
  assert.match(records, /INSERT INTO records/);
  assert.match(records, /db\.batch\(statements\)/);
  assert.match(records, /IMPORT_BATCH_TOO_LARGE/);
  assert.match(records, /LOWER\(TRIM\(reference\)\) IN/);
  assert.match(records, /const chunks = <T,>\(values: T\[\], size = 75\)/);
});

test("pipeline registra importações e falhas isoladas para correção", () => {
  assert.match(schema, /"importacoes"/);
  assert.match(schema, /"importacao_erros"/);
  assert.match(schema, /importacao_erros_busca/);
  assert.match(records, /saveImportReport/);
  assert.match(records, /listImportRuns/);
  assert.match(records, /resolveImportError/);
  assert.match(route, /view.*imports/);
  assert.match(app, /IMPORTAÇÕES E FILA DE CORREÇÃO/);
  assert.match(app, /Marcar como resolvida/);
});

test("normalizador de obras reconhece os aliases enviados", () => {
  assert.match(modules, /"Cód\. obra"/);
  assert.match(modules, /"ID obra"/);
  assert.match(modules, /"Responsável", "Líder", "Coordenador"/);
  assert.match(modules, /"Código gestor", "ID gestor", "Matrícula", "Cod gestor"/);
  assert.match(modules, /"Vencimento", "Dt previsão", "Dt\. previsão", "Dt prev"/);
  assert.match(modules, /"Data prev", "Data limite", "Prazo", "Data"/);
  assert.match(modules, /"Valor", "Vlr", "R\$", "Custo", "Montante", "Total", "Valor total"/);
  assert.match(modules, /"Serviço", "Descrição", "Atividade", "Nome do serviço", "Tarefa", "Desc"/);
});

test("adaptação Cloudflare não introduz bibliotecas incompatíveis", () => {
  const runtime = [records, route, app].join("\n");
  assert.doesNotMatch(runtime, /PrismaClient|from ['"]pg['"]|pg-format|createReadStream|fillfactor/);
  assert.match(records, /Cloudflare D1/);
});
