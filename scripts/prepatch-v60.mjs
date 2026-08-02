import { readFileSync, writeFileSync } from "node:fs";

const path = "scripts/apply-v60.mjs";
let source = readFileSync(path, "utf8");

const paymentBefore = `'      { key: "paymentDate", label: "Data do pagamento", type: "date" },\\n',\n    '      { key: "paymentDate", label: "Data do pagamento", type: "date" },\\n' +\n      '      { key: "receiptUrl", label: "Comprovante do pagamento da manutenção"`;
const paymentAfter = `'      { key: "paymentDate", label: "Data do pagamento da manutenção", type: "date" },\\n',\n    '      { key: "paymentDate", label: "Data do pagamento da manutenção", type: "date" },\\n' +\n      '      { key: "receiptUrl", label: "Comprovante do pagamento da manutenção"`;
if (!source.includes(paymentBefore)) {
  throw new Error("V60 prepatch: marcador da data de pagamento da manutenção não encontrado");
}
source = source.replace(paymentBefore, paymentAfter);

const boundaryBefore = 'const nextAsync = app.indexOf("\\n  async function", importFunctionStart + 20);';
const boundaryAfter = 'const nextAsync = app.indexOf("\\n  const displayName =", importFunctionStart + 20);';
if (!source.includes(boundaryBefore)) {
  throw new Error("V60 prepatch: limite da função de importação não encontrado");
}
source = source.replace(boundaryBefore, boundaryAfter);

writeFileSync(path, source, "utf8");
