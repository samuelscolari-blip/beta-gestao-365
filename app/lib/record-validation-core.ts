import {
  moduleMap,
  type ModuleDefinition,
  type ModuleField,
} from "./modules";

export type RecordValidationIssue = {
  field: string;
  message: string;
};

const isBlank = (value: unknown) =>
  value === null || value === undefined || String(value).trim() === "";

function validDate(value: unknown) {
  const date = String(value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === date
  );
}

function validateField(
  field: ModuleField,
  value: unknown,
): RecordValidationIssue[] {
  if (field.required && isBlank(value)) {
    return [
      {
        field: field.key,
        message: `O campo “${field.label}” é obrigatório.`,
      },
    ];
  }
  if (isBlank(value)) return [];

  if (field.type === "number" || field.type === "currency") {
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0) {
      return [
        {
          field: field.key,
          message: `O campo “${field.label}” deve conter um número igual ou maior que zero.`,
        },
      ];
    }
  }
  if (field.type === "date" && !validDate(value)) {
    return [
      {
        field: field.key,
        message: `O campo “${field.label}” deve conter uma data válida.`,
      },
    ];
  }
  if (field.type === "url") {
    try {
      const url = new URL(String(value));
      if (!["http:", "https:"].includes(url.protocol)) throw new Error();
    } catch {
      return [
        {
          field: field.key,
          message: `O campo “${field.label}” deve conter um link http ou https válido.`,
        },
      ];
    }
  }
  if (
    field.type === "email" &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim())
  ) {
    return [
      {
        field: field.key,
        message: `O campo “${field.label}” deve conter um e-mail válido.`,
      },
    ];
  }
  if (
    field.type === "select" &&
    field.options?.length &&
    !field.options.includes(String(value))
  ) {
    return [
      {
        field: field.key,
        message: `O valor informado em “${field.label}” não faz parte das opções permitidas.`,
      },
    ];
  }
  if (typeof value === "string" && value.length > 10_000) {
    return [
      {
        field: field.key,
        message: `O campo “${field.label}” ultrapassa o limite permitido.`,
      },
    ];
  }
  return [];
}

function numberValue(payload: Record<string, unknown>, key: string) {
  const value = Number(payload[key]);
  return Number.isFinite(value) ? value : 0;
}

type PaymentEvidenceRule = {
  statusKey: string;
  dateKey: string;
  amountKey: string;
  proofKey: string;
  expectedKeys: string[];
};

const paymentEvidenceRules: Record<string, PaymentEvidenceRule> = {
  expenses: { statusKey: "status", dateKey: "paymentDate", amountKey: "paidAmount", proofKey: "receiptUrl", expectedKeys: ["expectedAmount"] },
  taxes: { statusKey: "status", dateKey: "paymentDate", amountKey: "paidAmount", proofKey: "receiptUrl", expectedKeys: ["expectedAmount"] },
  purchases: { statusKey: "paymentStatus", dateKey: "paymentDate", amountKey: "paidAmount", proofKey: "receiptUrl", expectedKeys: ["totalAmount"] },
  cards: { statusKey: "status", dateKey: "paymentDate", amountKey: "paidAmount", proofKey: "receiptUrl", expectedKeys: ["amount"] },
  contractors: { statusKey: "status", dateKey: "paymentDate", amountKey: "paidAmount", proofKey: "receiptUrl", expectedKeys: ["netAmount", "measuredAmount"] },
  assets: { statusKey: "paymentStatus", dateKey: "paymentDate", amountKey: "paidAmount", proofKey: "receiptUrl", expectedKeys: ["monthlyCost"] },
  asset_events: { statusKey: "paymentStatus", dateKey: "paymentDate", amountKey: "paidAmount", proofKey: "receiptUrl", expectedKeys: ["maintenanceCost"] },
};

function normalizedStatus(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function validatePaymentEvidence(
  definition: ModuleDefinition,
  payload: Record<string, unknown>,
): RecordValidationIssue[] {
  const rule = paymentEvidenceRules[definition.id];
  if (!rule) return [];
  const status = normalizedStatus(payload[rule.statusKey]);
  if (!["pago", "paga"].includes(status)) return [];

  const issues: RecordValidationIssue[] = [];
  const paidAmount = numberValue(payload, rule.amountKey);
  const expectedAmount = rule.expectedKeys
    .map((key) => numberValue(payload, key))
    .find((value) => value > 0) || 0;

  if (isBlank(payload[rule.dateKey])) {
    issues.push({
      field: rule.dateKey,
      message: "Informe a data do pagamento antes de marcar o item como Pago.",
    });
  }
  if (paidAmount <= 0) {
    issues.push({
      field: rule.amountKey,
      message: "Informe o valor efetivamente pago antes de marcar o item como Pago.",
    });
  }
  if (isBlank(payload[rule.proofKey])) {
    issues.push({
      field: rule.proofKey,
      message: "Anexe ou informe o link do comprovante antes de marcar o item como Pago.",
    });
  }
  if (expectedAmount > 0 && paidAmount > expectedAmount + 0.01) {
    issues.push({
      field: rule.amountKey,
      message: "O valor pago não pode superar o valor previsto sem uma correção do lançamento.",
    });
  }
  return issues;
}

type ModuleValidator = (
  payload: Record<string, unknown>,
) => RecordValidationIssue[];

function validatePeopleBusinessRules(
  payload: Record<string, unknown>,
): RecordValidationIssue[] {
  const issues: RecordValidationIssue[] = [];
  const cpf = String(payload.cpf ?? "").replace(/\D/g, "");
  if (cpf && cpf.length !== 11) {
    issues.push({
      field: "cpf",
      message: "O CPF deve conter 11 dígitos.",
    });
  }
  if (
    payload.status === "Desligado" &&
    isBlank(payload.terminationDate)
  ) {
    issues.push({
      field: "terminationDate",
      message:
        "Informe a data de desligamento para um colaborador com status Desligado.",
    });
  }
  return issues;
}

function validateContractorBusinessRules(
  payload: Record<string, unknown>,
): RecordValidationIssue[] {
  const issues: RecordValidationIssue[] = [];
  const document = String(payload.cnpj ?? "").replace(/\D/g, "");
  if (document && ![11, 14].includes(document.length)) {
    issues.push({
      field: "cnpj",
      message: "O CPF ou CNPJ deve conter 11 ou 14 dígitos.",
    });
  }
  const workerCount = numberValue(payload, "workerCount");
  if (
    !isBlank(payload.workerCount) &&
    (!Number.isInteger(workerCount) || workerCount < 1)
  ) {
    issues.push({
      field: "workerCount",
      message:
        "Informe uma quantidade inteira de trabalhadores terceirizados, igual ou maior que 1.",
    });
  }
  const measured = numberValue(payload, "measuredAmount");
  const deductions =
    numberValue(payload, "retentionInss") +
    numberValue(payload, "retentionIss");
  if (deductions > measured) {
    issues.push({
      field: "retentionInss",
      message:
        "A soma das retenções não pode superar o valor bruto da medição.",
    });
  }
  [
    ["scopeWeight", "O peso do escopo"],
    ["plannedProgress", "A execução planejada"],
    ["executionProgress", "A execução comprovada"],
  ].forEach(([key, label]) => {
    if (numberValue(payload, key) > 100) {
      issues.push({
        field: key,
        message: `${label} deve ficar entre 0% e 100%.`,
      });
    }
  });
  return issues;
}

function validateWorkBusinessRules(
  payload: Record<string, unknown>,
): RecordValidationIssue[] {
  const issues: RecordValidationIssue[] = [];
  [
    ["plannedProgress", "O avanço planejado"],
    ["physicalProgress", "O avanço físico"],
    ["ownTeamProgress", "A execução da equipe própria"],
  ].forEach(([key, label]) => {
    if (numberValue(payload, key) > 100) {
      issues.push({
        field: key,
        message: `${label} deve ficar entre 0% e 100%.`,
      });
    }
  });
  if (
    !isBlank(payload.startDate) &&
    !isBlank(payload.endDate) &&
    String(payload.endDate) < String(payload.startDate)
  ) {
    issues.push({
      field: "endDate",
      message: "A previsão de término não pode ser anterior ao início da obra.",
    });
  }
  const dailyWorkHours = numberValue(payload, "dailyWorkHours");
  if (
    !isBlank(payload.dailyWorkHours) &&
    (dailyWorkHours <= 0 || dailyWorkHours > 24)
  ) {
    issues.push({
      field: "dailyWorkHours",
      message:
        "A jornada operacional deve ser maior que zero e não pode superar 24 horas.",
    });
  }
  const scheduleDelayDays = numberValue(payload, "scheduleDelayDays");
  if (!isBlank(payload.scheduleDelayDays) && scheduleDelayDays < 0) {
    issues.push({
      field: "scheduleDelayDays",
      message: "Os dias de atraso não podem ser negativos.",
    });
  }
  const totalPlannedDays = numberValue(payload, "totalPlannedDays");
  if (
    scheduleDelayDays > 0 &&
    totalPlannedDays > 0 &&
    scheduleDelayDays > totalPlannedDays
  ) {
    issues.push({
      field: "scheduleDelayDays",
      message:
        "Os dias de atraso não podem superar o prazo total planejado da obra.",
    });
  }
  return issues;
}

const moduleValidators: Partial<Record<string, ModuleValidator>> = {
  people: validatePeopleBusinessRules,
  contractors: validateContractorBusinessRules,
  works: validateWorkBusinessRules,
};

function validateRemainingBusinessRules(
  definition: ModuleDefinition,
  payload: Record<string, unknown>,
): RecordValidationIssue[] {
  const issues: RecordValidationIssue[] = [];

  if (definition.id === "suppliers") {
    const cnpj = String(payload.cnpj ?? "").replace(/\D/g, "");
    if (cnpj && cnpj.length !== 14) {
      issues.push({
        field: "cnpj",
        message: "O CNPJ deve conter 14 dígitos.",
      });
    }
  }

  if (definition.id === "worklogs") {
    if (numberValue(payload, "lostHours") > 24) {
      issues.push({
        field: "lostHours",
        message: "As horas improdutivas do apontamento não podem superar 24 horas.",
      });
    }
    if (
      String(payload.productivityStatus ?? "") !== "Produtivo" &&
      String(payload.unproductiveCause ?? "") === "Não se aplica"
    ) {
      issues.push({
        field: "unproductiveCause",
        message:
          "Informe a causa principal quando o dia estiver parcial ou totalmente improdutivo.",
      });
    }
    if (
      String(payload.productivityStatus ?? "") === "Produtivo" &&
      numberValue(payload, "lostHours") > 0
    ) {
      issues.push({
        field: "lostHours",
        message:
          "Um dia marcado como Produtivo não pode registrar horas improdutivas.",
      });
    }
    ["progressDelta", "progressPercentAfter"].forEach((key) => {
      if (numberValue(payload, key) > 100) {
        issues.push({
          field: key,
          message: "O avanço informado deve ficar entre 0% e 100%.",
        });
      }
    });
  }

  if (definition.id === "assets") {
    const rentalValue = numberValue(payload, "monthlyCost");
    const rentalDays = numberValue(payload, "rentalPeriodDays");
    const paidAmount = numberValue(payload, "paidAmount");
    if (
      String(payload.ownership ?? "") === "Locado" &&
      (rentalValue <= 0 || rentalDays <= 0)
    ) {
      issues.push({
        field: rentalValue <= 0 ? "monthlyCost" : "rentalPeriodDays",
        message:
          "Para uma máquina locada, informe o valor total e a quantidade de dias contratados.",
      });
    }
    if (
      !isBlank(payload.rentalPeriodDays) &&
      (!Number.isInteger(rentalDays) || rentalDays < 1 || rentalDays > 3660)
    ) {
      issues.push({
        field: "rentalPeriodDays",
        message:
          "A quantidade de dias contratados deve ser um número inteiro entre 1 e 3.660.",
      });
    }
    if (
      !isBlank(payload.startDate) &&
      !isBlank(payload.rentalEndDate) &&
      String(payload.rentalEndDate) < String(payload.startDate)
    ) {
      issues.push({
        field: "rentalEndDate",
        message: "O fim da locação não pode ser anterior ao início.",
      });
    }
    if (rentalValue > 0 && paidAmount > rentalValue) {
      issues.push({
        field: "paidAmount",
        message: "O valor pago da locação não pode superar o valor contratado.",
      });
    }
    if (
      String(payload.paymentStatus ?? "") === "Pago" &&
      isBlank(payload.paymentDate)
    ) {
      issues.push({
        field: "paymentDate",
        message:
          "Informe a data do pagamento quando a locação estiver marcada como Paga.",
      });
    }
    if (
      String(payload.paymentStatus ?? "") === "Parcial" &&
      (paidAmount <= 0 || paidAmount >= rentalValue)
    ) {
      issues.push({
        field: "paidAmount",
        message:
          "Para pagamento Parcial, informe um valor maior que zero e menor que o total da locação.",
      });
    }
  }

  if (definition.id === "asset_events") {
    const eventType = String(payload.eventType ?? "");
    const cause = String(payload.cause ?? "");
    const idleDays = numberValue(payload, "idleDays");
    const rentalDays = numberValue(payload, "rentalPeriodDays");
    const rentalValue = numberValue(payload, "rentalValue");
    const dailyRate = numberValue(payload, "dailyRentalRate");
    const estimatedLoss = numberValue(payload, "estimatedDowntimeLoss");
    const maintenanceCost = numberValue(payload, "maintenanceCost");
    const paidAmount = numberValue(payload, "paidAmount");

    if (
      !isBlank(payload.endDate) &&
      String(payload.endDate) < String(payload.startDate)
    ) {
      issues.push({
        field: "endDate",
        message: "O fim da ocorrência não pode ser anterior ao início.",
      });
    }
    if (
      !isBlank(payload.idleDays) &&
      (!Number.isInteger(idleDays) || idleDays < 0 || idleDays > 3660)
    ) {
      issues.push({
        field: "idleDays",
        message:
          "Os dias sem produzir devem formar um número inteiro entre 0 e 3.660.",
      });
    }
    if (rentalDays > 0 && idleDays > rentalDays) {
      issues.push({
        field: "idleDays",
        message:
          "Os dias sem produzir não podem superar o período contratado informado para esta ocorrência.",
      });
    }
    if (eventType === "Ociosidade" && cause === "Não se aplica") {
      issues.push({
        field: "cause",
        message: "Informe a causa da ociosidade da máquina.",
      });
    }
    if (
      eventType.startsWith("Manutenção") &&
      isBlank(payload.correctionDescription)
    ) {
      issues.push({
        field: "correctionDescription",
        message:
          "Descreva o que foi corrigido ou está sendo corrigido na manutenção.",
      });
    }
    const expectedDailyRate = rentalDays > 0 ? rentalValue / rentalDays : 0;
    const expectedLoss = expectedDailyRate * idleDays;
    if (
      Math.abs(dailyRate - expectedDailyRate) > 0.02 ||
      Math.abs(estimatedLoss - expectedLoss) > 0.02
    ) {
      issues.push({
        field: "estimatedDowntimeLoss",
        message:
          "O custo diário e a perda estimada precisam corresponder ao valor e ao período da locação.",
      });
    }
    if (maintenanceCost > 0 && paidAmount > maintenanceCost) {
      issues.push({
        field: "paidAmount",
        message:
          "O valor pago da manutenção não pode superar o custo total do serviço.",
      });
    }
    if (
      String(payload.paymentStatus ?? "") === "Pago" &&
      isBlank(payload.paymentDate)
    ) {
      issues.push({
        field: "paymentDate",
        message:
          "Informe a data do pagamento quando a manutenção estiver marcada como Paga.",
      });
    }
    if (
      String(payload.paymentStatus ?? "") === "Parcial" &&
      (paidAmount <= 0 || paidAmount >= maintenanceCost)
    ) {
      issues.push({
        field: "paidAmount",
        message:
          "Para pagamento Parcial, informe um valor maior que zero e menor que o custo da manutenção.",
      });
    }
  }

  if (definition.id === "compliance") {
    const status = String(payload.status ?? "");
    if (
      ["Transmitido", "Em processamento", "Processado com sucesso"].includes(
        status,
      ) &&
      isBlank(payload.batchProtocol)
    ) {
      issues.push({
        field: "batchProtocol",
        message:
          "Informe o protocolo oficial antes de marcar o evento como transmitido ou processado.",
      });
    }
    if (
      status === "Processado com sucesso" &&
      isBlank(payload.receiptNumber)
    ) {
      issues.push({
        field: "receiptNumber",
        message:
          "Informe o recibo oficial antes de marcar o evento como processado com sucesso.",
      });
    }
  }

  if (
    definition.id === "rules" &&
    !isBlank(payload.validUntil) &&
    String(payload.validUntil) < String(payload.validFrom)
  ) {
    issues.push({
      field: "validUntil",
      message: "O fim da vigência não pode ser anterior ao início.",
    });
  }

  if (
    definition.id === "rentals" &&
    numberValue(payload, "capacity") > 0 &&
    numberValue(payload, "occupants") > numberValue(payload, "capacity")
  ) {
    issues.push({
      field: "occupants",
      message:
        "A quantidade de moradores não pode superar a capacidade cadastrada.",
    });
  }

  if (
    definition.id === "food" &&
    numberValue(payload, "deliveredQty") > 0 &&
    numberValue(payload, "takenQty") >
      numberValue(payload, "deliveredQty")
  ) {
    issues.push({
      field: "takenQty",
      message:
        "A quantidade retirada não pode superar a quantidade entregue.",
    });
  }

  if (
    definition.id === "payroll" &&
    numberValue(payload, "netAmount") >
      numberValue(payload, "grossAmount")
  ) {
    issues.push({
      field: "netAmount",
      message:
        "O líquido da prévia não pode superar o bruto sem uma rubrica explicativa.",
    });
  }

  if (definition.id === "terminations") {
    if (
      !isBlank(payload.admissionDate) &&
      !isBlank(payload.terminationDate) &&
      String(payload.terminationDate) < String(payload.admissionDate)
    ) {
      issues.push({
        field: "terminationDate",
        message: "O desligamento não pode ocorrer antes da admissão.",
      });
    }
    if (
      numberValue(payload, "netAmount") >
      numberValue(payload, "grossAmount")
    ) {
      issues.push({
        field: "netAmount",
        message:
          "O líquido rescisório não pode superar o bruto sem uma verba explicativa.",
      });
    }
    if (
      numberValue(payload, "totalDeductions") >
      numberValue(payload, "grossAmount") &&
      numberValue(payload, "netAmount") > 0
    ) {
      issues.push({
        field: "totalDeductions",
        message:
          "Quando os descontos superam o bruto, o líquido calculado deve ser zero e a diferença precisa de tratamento próprio.",
      });
    }
    if (String(payload.terminationType ?? "") === "EMPLOYEE_DEATH") {
      if (
        isBlank(payload.deathDate) ||
        String(payload.deathDate) !== String(payload.terminationDate)
      ) {
        issues.push({
          field: "deathDate",
          message:
            "No falecimento, a data do óbito deve ser igual à data do desligamento.",
        });
      }
      if (isBlank(payload.deathKnowledgeDate)) {
        issues.push({
          field: "deathKnowledgeDate",
          message:
            "Informe a data em que a empresa tomou conhecimento do falecimento.",
        });
      } else if (
        !isBlank(payload.deathDate) &&
        String(payload.deathKnowledgeDate) < String(payload.deathDate)
      ) {
        issues.push({
          field: "deathKnowledgeDate",
          message:
            "A ciência da empresa não pode ser anterior à data do óbito.",
        });
      }
    }
    if (
      [
        "EARLY_EMPLOYER_FIXED_TERM",
        "EARLY_EMPLOYEE_FIXED_TERM",
      ].includes(String(payload.terminationType ?? ""))
    ) {
      if (isBlank(payload.expectedContractEnd)) {
        issues.push({
          field: "expectedContractEnd",
          message:
            "Informe a data prevista para o término do contrato a prazo.",
        });
      } else if (
        !isBlank(payload.terminationDate) &&
        String(payload.expectedContractEnd) <=
          String(payload.terminationDate)
      ) {
        issues.push({
          field: "expectedContractEnd",
          message:
            "O término previsto deve ser posterior ao desligamento antecipado.",
        });
      }
    }
    if (
      ["Transmitido", "Processado"].includes(
        String(payload.esocialStatus ?? ""),
      )
    ) {
      issues.push({
        field: "esocialStatus",
        message:
          "Este módulo gera somente prévias e não pode marcar o S-2299 como transmitido ou processado.",
      });
    }
  }

  issues.push(...validatePaymentEvidence(definition, payload));

  return issues;
}

function validateBusinessRules(
  definition: ModuleDefinition,
  payload: Record<string, unknown>,
): RecordValidationIssue[] {
  const validator = moduleValidators[definition.id];
  return [
    ...(validator ? validator(payload) : []),
    ...validateRemainingBusinessRules(definition, payload),
  ];
}


export function validateRecordPayload(
  moduleId: string,
  payload: Record<string, unknown>,
) {
  if (moduleId === "settings") return [];
  const definition = moduleMap[moduleId];
  if (!definition) {
    return [
      {
        field: "module",
        message: "O módulo informado não possui definição de dados.",
      },
    ];
  }
  return [
    ...definition.fields.flatMap((field) =>
      validateField(field, payload[field.key]),
    ),
    ...validateBusinessRules(definition, payload),
  ];
}
