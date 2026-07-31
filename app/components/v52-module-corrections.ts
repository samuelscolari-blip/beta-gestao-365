import "./BetaAppV52";
import { moduleMap, type ModuleDefinition, type ModuleField } from "../lib/modules";

function removeFields(module: ModuleDefinition, keys: string[]) {
  const removed = new Set(keys);
  module.fields = module.fields.filter((field) => !removed.has(field.key));
}

function addAfter(
  module: ModuleDefinition,
  afterKey: string,
  field: ModuleField,
) {
  if (module.fields.some((candidate) => candidate.key === field.key)) return;
  const index = module.fields.findIndex((candidate) => candidate.key === afterKey);
  module.fields.splice(index < 0 ? module.fields.length : index + 1, 0, field);
}

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
  aliases: ["CPF/CNPJ estabelecimento", "CNPJ estabelecimento", "Documento estabelecimento"],
});
cards.tableColumns = cards.tableColumns.map((key) => {
  if (key === "holder") return "cardName";
  if (key === "cardEnding") return "merchantDocument";
  return key;
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

const rentals = moduleMap.rentals;
removeFields(rentals, ["work"]);
addAfter(rentals, "landlord", {
  key: "landlordDocument",
  label: "CPF ou CNPJ do locador",
  type: "text",
  required: true,
  placeholder: "Documento do proprietário ou empresa locadora",
  aliases: ["CPF/CNPJ locador", "CNPJ locador", "Documento locador"],
});

const purchases = moduleMap.purchases;
addAfter(purchases, "supplier", {
  key: "supplierDocument",
  label: "CPF ou CNPJ do fornecedor selecionado",
  type: "text",
  placeholder: "Preencha quando o fornecedor já estiver definido",
  aliases: ["CPF/CNPJ", "CNPJ fornecedor", "Documento fornecedor"],
});

export const v52ModuleCorrectionsReady = true;
