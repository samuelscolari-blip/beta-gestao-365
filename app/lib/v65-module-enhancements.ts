import {
  moduleMap,
  moduleTips,
  type ModuleDefinition,
  type ModuleField,
} from "./modules";

function appendField(
  definition: ModuleDefinition | undefined,
  field: ModuleField,
) {
  if (!definition || definition.fields.some((item) => item.key === field.key)) {
    return;
  }
  definition.fields.push(field);
}

function appendColumn(definition: ModuleDefinition | undefined, key: string) {
  if (!definition || definition.tableColumns.includes(key)) return;
  const statusIndex = definition.tableColumns.indexOf("status");
  if (statusIndex >= 0) definition.tableColumns.splice(statusIndex, 0, key);
  else definition.tableColumns.push(key);
}

function insertColumnAfter(
  definition: ModuleDefinition | undefined,
  key: string,
  afterKey: string,
) {
  if (!definition || definition.tableColumns.includes(key)) return;
  const index = definition.tableColumns.indexOf(afterKey);
  if (index >= 0) definition.tableColumns.splice(index + 1, 0, key);
  else definition.tableColumns.unshift(key);
}

function appendPaymentEvidenceFields(
  definition: ModuleDefinition | undefined,
  expectedLabel: string,
) {
  appendField(definition, {
    key: "paymentDate",
    label: "Data do pagamento",
    type: "date",
    aliases: ["Data pagamento"],
  });
  appendField(definition, {
    key: "paidAmount",
    label: "Valor efetivamente pago",
    type: "currency",
    aliases: ["Valor pago"],
  });
  appendField(definition, {
    key: "receiptUrl",
    label: "Comprovante de pagamento",
    type: "url",
    placeholder: "Cole o link do comprovante",
    aliases: ["Link comprovante", "Comprovante"],
    help: `Obrigatório ao registrar o pagamento do ${expectedLabel}.`,
  });
  appendColumn(definition, "receiptUrl");
}

function applyPaymentFields(
  moduleId: "rentals" | "food",
  expectedLabel: string,
) {
  const definition = moduleMap[moduleId];
  appendField(definition, {
    key: "paymentStatus",
    label: "Situação do pagamento",
    type: "select",
    options: ["Pendente", "Parcial", "Pago", "Não se aplica"],
    aliases: ["Status pagamento", "Situação pagamento"],
    help: `Use Pago somente depois de registrar data, valor e comprovante do ${expectedLabel}.`,
  });
  appendPaymentEvidenceFields(definition, expectedLabel);
  appendColumn(definition, "paymentStatus");
}

const marker = moduleMap as typeof moduleMap & { __v65Applied?: boolean };

if (!marker.__v65Applied) {
  marker.__v65Applied = true;

  applyPaymentFields("rentals", "aluguel e das contas do imóvel");
  applyPaymentFields("food", "fornecimento de alimentação");

  // CPF já faz parte da ficha oficial do colaborador. A tela administrativa
  // precisa exibir o valor já persistido para conferência diária do RH, sem
  // criar novo campo, duplicar cadastro ou exigir reimportação.
  insertColumnAfter(moduleMap.people, "cpf", "name");

  // A configuração visual V52 simplificou a tela do cartão e removeu estes
  // campos. Eles precisam voltar para que o usuário consiga cumprir a regra
  // que bloqueia o status Paga sem data, valor e comprovante.
  appendPaymentEvidenceFields(moduleMap.cards, "cartão corporativo");

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
  moduleTips.cards =
    "Informe cartão, estabelecimento, itens e documento fiscal. Ao marcar a fatura como Paga, registre data, valor e comprovante.";
  moduleTips.compliance =
    "Use esta tela para preparar, validar e acompanhar cada obrigação. Transmissão só é confirmada com protocolo; processamento só é confirmado com recibo ou retorno oficial.";
  moduleTips.rules =
    "A regra organiza fonte, vigência, escopo e procedimento. Só marque como Ativa depois de documentar teste, resultado esperado, responsável e evidência de homologação.";
}
