import {
  moduleMap,
  moduleTips,
  type ModuleDefinition,
  type ModuleField,
} from "./modules";

function appendField(module: ModuleDefinition | undefined, field: ModuleField) {
  if (!module || module.fields.some((item) => item.key === field.key)) return;
  module.fields.push(field);
}

function appendColumn(module: ModuleDefinition | undefined, key: string) {
  if (!module || module.tableColumns.includes(key)) return;
  const statusIndex = module.tableColumns.indexOf("status");
  if (statusIndex >= 0) module.tableColumns.splice(statusIndex, 0, key);
  else module.tableColumns.push(key);
}

function applyPaymentFields(
  moduleId: "rentals" | "food",
  expectedLabel: string,
) {
  const module = moduleMap[moduleId];
  appendField(module, {
    key: "paymentStatus",
    label: "Situação do pagamento",
    type: "select",
    options: ["Pendente", "Parcial", "Pago", "Não se aplica"],
    aliases: ["Status pagamento", "Situação pagamento"],
    help: `Use Pago somente depois de registrar data, valor e comprovante do ${expectedLabel}.`,
  });
  appendField(module, {
    key: "paymentDate",
    label: "Data do pagamento",
    type: "date",
    aliases: ["Data pagamento"],
  });
  appendField(module, {
    key: "paidAmount",
    label: "Valor efetivamente pago",
    type: "currency",
    aliases: ["Valor pago"],
  });
  appendField(module, {
    key: "receiptUrl",
    label: "Comprovante de pagamento",
    type: "url",
    placeholder: "Cole o link do comprovante",
    aliases: ["Link comprovante", "Comprovante"],
  });
  appendColumn(module, "paymentStatus");
  appendColumn(module, "receiptUrl");
}

const marker = moduleMap as typeof moduleMap & { __v65Applied?: boolean };

if (!marker.__v65Applied) {
  marker.__v65Applied = true;

  applyPaymentFields("rentals", "aluguel e das contas do imóvel");
  applyPaymentFields("food", "fornecimento de alimentação");

  const compliance = moduleMap.compliance;
  appendField(compliance, {
    key: "dueDate",
    label: "Prazo operacional",
    type: "date",
    help: "Data interna para acompanhamento da entrega; deve ser conferida com a fonte oficial aplicável.",
  });
  appendField(compliance, {
    key: "checklistUrl",
    label: "Checklist e evidências da conferência",
    type: "url",
    placeholder: "Cole o link do checklist",
  });
  appendField(compliance, {
    key: "rejectionReason",
    label: "Motivo da rejeição ou pendência",
    type: "textarea",
    wide: true,
  });
  appendColumn(compliance, "dueDate");

  const rules = moduleMap.rules;
  appendField(rules, {
    key: "testScenario",
    label: "Cenário de teste da regra",
    type: "textarea",
    wide: true,
    placeholder: "Descreva os dados de entrada usados para homologar a regra.",
    help: "Toda regra ativa deve possuir ao menos um cenário reproduzível.",
  });
  appendField(rules, {
    key: "expectedResult",
    label: "Resultado esperado do teste",
    type: "textarea",
    wide: true,
    placeholder: "Informe o resultado esperado e a memória de conferência.",
  });
  appendField(rules, {
    key: "lastValidatedAt",
    label: "Última homologação",
    type: "date",
  });

  moduleTips.rentals =
    "Informe moradores, responsáveis e custos. Ao registrar pagamento parcial ou integral, inclua data, valor e comprovante.";
  moduleTips.food =
    "Compare previsto, entregue e retirado. Quando a cobrança for paga, registre data, valor e comprovante para fechar o histórico.";
  moduleTips.compliance =
    "Use esta tela para preparar, validar e acompanhar cada obrigação. Transmissão só é confirmada com protocolo; processamento só é confirmado com recibo ou retorno oficial.";
  moduleTips.rules =
    "A regra organiza fonte, vigência, escopo e procedimento. Só marque como Ativa depois de documentar teste, resultado esperado, responsável e evidência de homologação.";
}
