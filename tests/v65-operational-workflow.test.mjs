import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const enhancements = await readFile(
  "app/lib/v65-module-enhancements.ts",
  "utf8",
);
const validation = await readFile(
  "app/lib/record-validation.ts",
  "utf8",
);
const validationCore = await readFile(
  "app/lib/record-validation-core.ts",
  "utf8",
);
const preflight = await readFile(
  "app/lib/import-preflight-v65.ts",
  "utf8",
);
const secure = await readFile(
  "app/components/SecureBetaAppV65.tsx",
  "utf8",
);
const app = await readFile("app/components/BetaApp.tsx", "utf8");
const payrollRoute = await readFile(
  "app/api/payroll-preview/route.ts",
  "utf8",
);
const layout = await readFile("app/layout.tsx", "utf8");
const professionalCss = await readFile(
  "app/professional-layout-v64.css",
  "utf8",
);
const v65Css = await readFile("app/v65.css", "utf8");
const page = await readFile("app/page.tsx", "utf8");

test("V65 exige evidência em todos os novos fluxos de pagamento", () => {
  assert.match(enhancements, /applyPaymentFields\("rentals"/);
  assert.match(enhancements, /applyPaymentFields\("food"/);
  assert.match(enhancements, /key: "paymentStatus"/);
  assert.match(enhancements, /key: "receiptUrl"/);
  assert.match(validation, /rentals: \{ statusKey: "paymentStatus"/);
  assert.match(validation, /food: \{ statusKey: "paymentStatus"/);
  assert.match(validation, /Anexe ou informe o link do comprovante/);
  assert.match(validation, /Quando o valor pago alcançar o total previsto/);
  assert.match(validationCore, /validatePaymentEvidence/);
});

test("V65 preserva os grupos de funcionários e a seleção ativa da folha", () => {
  assert.match(app, /people-status-tabs/);
  assert.match(app, /Ativos/);
  assert.match(app, /Férias/);
  assert.match(app, /Inativos/);
  assert.match(payrollRoute, /person\.status\.toLowerCase\(\) === "ativo"/);
});

test("V65 torna Fiscal e Compliance um fluxo controlado", () => {
  assert.match(enhancements, /key: "dueDate"/);
  assert.match(enhancements, /key: "checklistUrl"/);
  assert.match(enhancements, /key: "rejectionReason"/);
  assert.match(validation, /Conclua a validação interna/);
  assert.match(validation, /Informe o certificado ou a procuração/);
  assert.match(validation, /Registre o motivo da rejeição/);
});

test("V65 só ativa regra documentada e homologada", () => {
  assert.match(enhancements, /key: "testScenario"/);
  assert.match(enhancements, /key: "expectedResult"/);
  assert.match(enhancements, /key: "lastValidatedAt"/);
  assert.match(validation, /validateActiveRule/);
  assert.match(validation, /Documente um cenário de teste/);
  assert.match(validation, /Anexe a evidência de homologação/);
  assert.match(validation, /Informe o responsável pela homologação/);
  assert.doesNotMatch(validation, /eval\(|new Function/);
});

test("V65 revisa planilhas ambíguas antes da importação", () => {
  assert.match(preflight, /second\.score >= first\.score \* 0\.82/);
  assert.match(preflight, /Revisão necessária antes de importar/);
  assert.match(preflight, /Nenhuma aba apresentou cabeçalhos suficientes/);
  assert.match(secure, /window\.addEventListener\("change", interceptFile, true\)/);
  assert.match(secure, /Continuar para a prévia/);
  assert.match(secure, /dispatchValidatedFile/);
});

test("V65 mostra decisões aprovadas sem remover as filas anteriores", () => {
  assert.match(secure, /Aprovados <span>\{approved\.length\}<\/span>/);
  assert.match(secure, /v65-approved-overview/);
  assert.match(secure, /decisionModules = new Set\(\["purchases", "expenses", "cards"\]\)/);
  assert.match(v65Css, /v65-show-approved \.management-list/);
  assert.match(v65Css, /v65-approved-row/);
  assert.match(page, /SecureBetaAppV65/);
});

test("V65 preserva a remoção de Operação Própria e o acabamento executivo", () => {
  assert.doesNotMatch(app, /construction-workforce-card/);
  assert.match(layout, /professional-layout-v64\.css/);
  assert.match(layout, /v65\.css/);
  assert.match(professionalCss, /container-name: construction-executive/);
  assert.match(professionalCss, /construction-machine-row/);
});
