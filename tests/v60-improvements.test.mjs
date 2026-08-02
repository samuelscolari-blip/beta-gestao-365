import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const modules = await readFile("app/lib/modules.ts", "utf8");
const validation = await readFile("app/lib/record-validation.ts", "utf8");
const spreadsheet = await readFile("app/lib/spreadsheet.ts", "utf8");
const app = await readFile("app/components/BetaApp.tsx", "utf8");
const layout = await readFile("app/layout.tsx", "utf8");
const css = await readFile("app/v60.css", "utf8");

test("V60 exige comprovante, data e valor para pagamentos confirmados", () => {
  assert.match(validation, /paymentEvidenceRules/);
  assert.match(validation, /Anexe ou informe o link do comprovante/);
  assert.match(validation, /Informe o valor efetivamente pago/);
  assert.match(validation, /purchases: { statusKey: "paymentStatus"/);
  assert.match(modules, /Comprovante de pagamento da fatura/);
  assert.match(modules, /Comprovante do pagamento da locação/);
  assert.match(modules, /Comprovante do pagamento da manutenção/);
});

test("V60 organiza colaboradores sem cálculo de férias fixo", () => {
  assert.match(app, /people-status-tabs/);
  assert.match(app, /Ativos/);
  assert.match(app, /Férias/);
  assert.match(app, /Inativos/);
  assert.match(modules, /vacationAcquisitionStart/);
  assert.doesNotMatch(modules, /2020-01-06T00:00:00Z/);
});

test("V60 mantém o motor de regras honesto e auditável", () => {
  assert.match(app, /O que o Motor de Regras faz hoje/);
  assert.match(app, /Uma regra cadastrada não executa código automaticamente/);
  assert.doesNotMatch(app, /MotorDeRegrasExecucao/);
});

test("V60 importa Excel com detecção, prévia, validação e lotes", () => {
  assert.match(spreadsheet, /sheetScore/);
  assert.match(spreadsheet, /validateRecordPayload/);
  assert.match(spreadsheet, /duplicates/);
  assert.match(app, /Prévia da importação/);
  assert.match(app, /batchSize = 250/);
  assert.doesNotMatch(spreadsheet, /csv-parser|bullmq|createReadStream/);
});

test("V60 remove Operação Própria e alinha o painel da obra", () => {
  assert.doesNotMatch(app, /construction-workforce-card/);
  assert.match(css, /construction-operational-detail-grid/);
  assert.match(css, /scroll-snap-type: x proximity/);
  assert.match(layout, /v60\.css/);
});
