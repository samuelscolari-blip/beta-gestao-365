import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  spreadsheetDateValue,
  expandSpreadsheetDateMatrix,
} from "../app/lib/spreadsheet-layout.mjs";
import { findSemanticHeaderIndex } from "../app/lib/spreadsheet-semantic.mjs";

const spreadsheet = await readFile("app/lib/spreadsheet.ts", "utf8");
const policy = await readFile("app/lib/import-policy.ts", "utf8");
const app = await readFile("app/components/BetaApp.tsx", "utf8");

test("V61 restringe a importação a Custos, Máquinas e Funcionários", () => {
  assert.match(policy, /id: "costs"/);
  assert.match(policy, /id: "machines"/);
  assert.match(policy, /id: "employees"/);
  assert.match(policy, /"expenses"/);
  assert.match(policy, /"assets"/);
  assert.match(policy, /"people"/);
  assert.doesNotMatch(policy, /modules: \[[^\]]*"works"/s);
  assert.doesNotMatch(policy, /modules: \[[^\]]*"compliance"/s);
  assert.doesNotMatch(policy, /modules: \[[^\]]*"rules"/s);
});

test("V61 protege o importador na interface e na camada de leitura", () => {
  assert.match(app, /isImportableModule\(module\.id\)/);
  assert.match(app, /Este módulo não aceita importação automática/);
  assert.match(app, /Importar Custos, Máquinas ou Funcionários/);
  assert.match(spreadsheet, /allowedImportModuleIds\.has\(module\.id\)/);
  assert.match(spreadsheet, /targetModuleId && !isImportableModule\(targetModuleId\)/);
});

test("V61 informa família, orientação, confiança e erros na prévia", () => {
  assert.match(spreadsheet, /family: importFamilyForModule/);
  assert.match(spreadsheet, /layout: parsed\.layout/);
  assert.match(spreadsheet, /invalidExamples/);
  assert.match(app, /item\.family/);
  assert.match(app, /item\.layout/);
  assert.match(app, /item\.confidence/);
  assert.match(app, /Pendências encontradas/);
});

test("V61 reconhece data serial do Excel", () => {
  assert.equal(spreadsheetDateValue(46237), "2026-08-03");
});

test("V61 faz mapeamento semântico conservador de cabeçalhos", () => {
  assert.equal(
    findSemanticHeaderIndex(
      ["Nome do colaborador", "Vlr. Total!", "Dt. vencimento"],
      ["Valor total", "Valor"],
    ),
    1,
  );
  assert.equal(
    findSemanticHeaderIndex(
      ["Nome do colaborador", "Vlr. Total!", "Dt. vencimento"],
      ["Vencimento", "Data limite"],
    ),
    2,
  );
});

test("V61 expande matriz de três dias em três lançamentos", () => {
  const rows = [
    ["Descrição", "Pessoa", "03/08/2026", "04/08/2026", "05/08/2026"],
    ["Almoço", "Matheus", 60.2, 60.2, 60.2],
  ];
  const expanded = expandSpreadsheetDateMatrix(rows, {
    titleField: "description",
    dateField: "date",
    amountField: "amount",
    fields: [
      { key: "description", label: "Descrição", aliases: ["Histórico"] },
      { key: "person", label: "Pessoa", aliases: ["Colaborador"] },
    ],
  });
  assert.equal(expanded.matched, true);
  assert.equal(expanded.payloadRows.length, 3);
  assert.deepEqual(
    expanded.payloadRows.map((item) => item.payload.date),
    ["2026-08-03", "2026-08-04", "2026-08-05"],
  );
});

test("V61 não usa Prisma, PostgreSQL, AWS SDK ou Cloudflare Pages", () => {
  assert.doesNotMatch(spreadsheet, /PrismaClient|@aws-sdk|postgresql|pages-action/);
  assert.doesNotMatch(app, /PrismaClient|@aws-sdk|pages-action/);
});
