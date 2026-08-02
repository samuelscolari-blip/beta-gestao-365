import { readFileSync, writeFileSync } from "node:fs";

const path = "scripts/apply-v60.mjs";
let source = readFileSync(path, "utf8");
const before = `'      { key: "paymentDate", label: "Data do pagamento", type: "date" },\\n',\n    '      { key: "paymentDate", label: "Data do pagamento", type: "date" },\\n' +\n      '      { key: "receiptUrl", label: "Comprovante do pagamento da manutenção"`;
const after = `'      { key: "paymentDate", label: "Data do pagamento da manutenção", type: "date" },\\n',\n    '      { key: "paymentDate", label: "Data do pagamento da manutenção", type: "date" },\\n' +\n      '      { key: "receiptUrl", label: "Comprovante do pagamento da manutenção"`;
if (!source.includes(before)) {
  throw new Error("V60 prepatch: marcador da data de pagamento da manutenção não encontrado");
}
source = source.replace(before, after);
writeFileSync(path, source, "utf8");
