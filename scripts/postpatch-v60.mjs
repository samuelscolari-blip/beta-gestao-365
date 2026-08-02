import { readFileSync, writeFileSync } from "node:fs";

const path = "db/demo-records.ts";
let content = readFileSync(path, "utf8");

function replaceOnce(before, after, label) {
  if (!content.includes(before)) {
    throw new Error(`V60 demo migration: marcador não encontrado em ${label}`);
  }
  content = content.replace(before, after);
}

replaceOnce(
  '    status: "Paga", responsible: "Financeiro Teste",\n',
  '    status: "Paga", paymentDate: "2026-07-14", paidAmount: 640,\n    receiptUrl: docs("comprovante-cartao-003"), responsible: "Financeiro Teste",\n',
  "TST-CC-003",
);

replaceOnce(
  '    paymentDate: "2026-07-24", nextMaintenance: "2026-07-30", meter: 18420,\n',
  '    paymentDate: "2026-07-24", receiptUrl: docs("comprovante-ativo-003"),\n    nextMaintenance: "2026-07-30", meter: 18420,\n',
  "TST-ATV-003",
);

replaceOnce(
  '    paymentDate: "2026-07-08", nextMaintenance: "2026-08-20", meter: 186,\n',
  '    paymentDate: "2026-07-08", receiptUrl: docs("comprovante-ativo-006"),\n    nextMaintenance: "2026-08-20", meter: 186,\n',
  "TST-ATV-006",
);

replaceOnce(
  '    dueDate: "2026-07-26", paymentDate: "2026-07-25", status: "Concluída",\n',
  '    dueDate: "2026-07-26", paymentDate: "2026-07-25",\n    receiptUrl: docs("comprovante-ocorrencia-003"), status: "Concluída",\n',
  "TST-OCO-003",
);

writeFileSync(path, content, "utf8");
