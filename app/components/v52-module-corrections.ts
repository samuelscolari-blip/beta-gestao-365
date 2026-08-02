import { moduleMap, type ModuleDefinition, type ModuleField } from "../lib/modules";

function removeFields(moduleDefinition: ModuleDefinition, keys: string[]) {
  const removed = new Set(keys);
  moduleDefinition.fields = moduleDefinition.fields.filter(
    (field) => !removed.has(field.key),
  );
}

function addAfter(
  moduleDefinition: ModuleDefinition,
  afterKey: string,
  field: ModuleField,
) {
  if (moduleDefinition.fields.some((candidate) => candidate.key === field.key)) {
    return;
  }
  const index = moduleDefinition.fields.findIndex(
    (candidate) => candidate.key === afterKey,
  );
  moduleDefinition.fields.splice(
    index < 0 ? moduleDefinition.fields.length : index + 1,
    0,
    field,
  );
}

let applied = false;

export function applyV52ModuleCorrections() {
  if (applied) return;
  applied = true;

  const expenses = moduleMap.expenses;
  removeFields(expenses, ["supplierCode"]);
  addAfter(expenses, "supplier", {
    key: "supplierDocument",
    label: "CPF ou CNPJ do fornecedor",
    type: "text",
    required: true,
    placeholder: "Documento do emissor da venda",
    help: "Informe o documento que consta na nota, cupom ou recibo.",
    aliases: ["CPF/CNPJ", "CNPJ", "CPF", "Documento fornecedor"],
  });
  expenses.tableColumns = expenses.tableColumns.map((key) =>
    key === "supplierCode" ? "supplierDocument" : key,
  );

  const cards = moduleMap.cards;
  removeFields(cards, ["holder", "cardEnding"]);
  addAfter(cards, "expenseId", {
    key: "cardName",
    label: "Nome do cartão",
    type: "text",
    required: true,
    placeholder: "Ex.: Cartão Obras 01",
    aliases: ["Cartão", "Nome cartão", "Nome do cartão"],
  });
  addAfter(cards, "merchant", {
    key: "merchantDocument",
    label: "CPF ou CNPJ do estabelecimento",
    type: "text",
    required: true,
    placeholder: "Documento exibido no comprovante fiscal",
    aliases: [
      "CPF/CNPJ estabelecimento",
      "CNPJ estabelecimento",
      "Documento estabelecimento",
    ],
  });
  cards.tableColumns = cards.tableColumns.map((key) => {
    if (key === "holder") return "cardName";
    if (key === "cardEnding") return "merchantDocument";
    return key;
  });
  ["paymentDate", "paidAmount", "receiptUrl"].forEach((key) => {
    if (!cards.tableColumns.includes(key)) cards.tableColumns.push(key);
  });

  const food = moduleMap.food;
  removeFields(food, ["supplierCode"]);
  addAfter(food, "supplier", {
    key: "supplierDocument",
    label: "CPF ou CNPJ do fornecedor",
    type: "text",
    required: true,
    placeholder: "Documento exibido no comprovante fiscal",
    aliases: ["CPF/CNPJ", "CNPJ", "Documento fornecedor"],
  });
  ["paymentStatus", "paymentDate", "paidAmount", "receiptUrl"].forEach((key) => {
    if (!food.tableColumns.includes(key)) food.tableColumns.push(key);
  });

  const rentals = moduleMap.rentals;
  const workField = rentals.fields.find((field) => field.key === "work");
  if (workField) {
    Object.assign(workField, {
      label: "Obra vinculada",
      placeholder: "Nome ou código da obra",
      required: false,
      help: "Obra atendida pelo imóvel; não confundir com o documento do locador.",
    });
  }
  addAfter(rentals, "landlord", {
    key: "landlordDocument",
    label: "CPF ou CNPJ do locador",
    type: "text",
    required: true,
    placeholder: "Documento do proprietário ou empresa locadora",
    aliases: ["CPF/CNPJ locador", "CNPJ locador", "Documento locador"],
  });
  if (!rentals.tableColumns.includes("work")) {
    rentals.tableColumns.splice(1, 0, "work");
  }
  if (!rentals.tableColumns.includes("landlordDocument")) {
    rentals.tableColumns.push("landlordDocument");
  }
  ["paymentStatus", "paymentDate", "paidAmount", "receiptUrl"].forEach((key) => {
    if (!rentals.tableColumns.includes(key)) rentals.tableColumns.push(key);
  });

  const purchases = moduleMap.purchases;
  addAfter(purchases, "supplier", {
    key: "supplierDocument",
    label: "CPF ou CNPJ do fornecedor selecionado",
    type: "text",
    placeholder: "Preencha quando o fornecedor já estiver definido",
    aliases: ["CPF/CNPJ", "CNPJ fornecedor", "Documento fornecedor"],
  });
}
