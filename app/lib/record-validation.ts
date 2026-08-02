import "./v65-module-enhancements";
import {
  validateRecordPayload as validateCoreRecordPayload,
  type RecordValidationIssue,
} from "./record-validation-core";

export type { RecordValidationIssue } from "./record-validation-core";

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
  rentals: { statusKey: "paymentStatus", dateKey: "paymentDate", amountKey: "paidAmount", proofKey: "receiptUrl", expectedKeys: ["totalMonthly"] },
  food: { statusKey: "paymentStatus", dateKey: "paymentDate", amountKey: "paidAmount", proofKey: "receiptUrl", expectedKeys: ["billedTotal", "expectedTotal"] },
};

function isBlank(value: unknown) {
  return value === null || value === undefined || String(value).trim() === "";
}

function normalized(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function isDemonstrationPayload(payload: Record<string, unknown>) {
  return (
    payload.isDemo === true ||
    normalized(payload.notes).includes("registro ficticio para teste")
  );
}

function numberValue(payload: Record<string, unknown>, key: string) {
  const value = Number(payload[key]);
  return Number.isFinite(value) ? value : 0;
}

function expectedPaymentAmount(
  moduleId: string,
  payload: Record<string, unknown>,
  rule: PaymentEvidenceRule,
) {
  if (moduleId === "rentals") {
    const declaredTotal = numberValue(payload, "totalMonthly");
    if (declaredTotal > 0) return declaredTotal;
    return (
      numberValue(payload, "monthlyRent") +
      numberValue(payload, "water") +
      numberValue(payload, "energy") +
      numberValue(payload, "internet")
    );
  }
  return (
    rule.expectedKeys
      .map((key) => numberValue(payload, key))
      .find((value) => value > 0) || 0
  );
}

function validatePaymentEvidence(
  moduleId: string,
  payload: Record<string, unknown>,
): RecordValidationIssue[] {
  const rule = paymentEvidenceRules[moduleId];
  if (!rule) return [];

  const status = normalized(payload[rule.statusKey]);
  const isPaid = status === "pago" || status === "paga";
  const isPartial = status === "parcial";
  if (!isPaid && !isPartial) return [];

  const issues: RecordValidationIssue[] = [];
  const paidAmount = numberValue(payload, rule.amountKey);
  const expectedAmount = expectedPaymentAmount(moduleId, payload, rule);

  if (isBlank(payload[rule.dateKey])) {
    issues.push({
      field: rule.dateKey,
      message: isPaid
        ? "Informe a data do pagamento antes de marcar o item como Pago."
        : "Informe a data do pagamento parcial.",
    });
  }
  if (paidAmount <= 0) {
    issues.push({
      field: rule.amountKey,
      message: isPaid
        ? "Informe o valor efetivamente pago antes de marcar o item como Pago."
        : "Informe o valor efetivamente pago na parcela.",
    });
  }
  if (isBlank(payload[rule.proofKey])) {
    issues.push({
      field: rule.proofKey,
      message: isPaid
        ? "Anexe ou informe o link do comprovante antes de marcar o item como Pago."
        : "Anexe ou informe o link do comprovante do pagamento parcial.",
    });
  }
  if (
    isPaid &&
    expectedAmount > 0 &&
    paidAmount < expectedAmount - 0.01
  ) {
    issues.push({
      field: rule.amountKey,
      message:
        "Para quitar integralmente, o valor pago não pode ser menor que o previsto. Use o status Parcial se houver saldo remanescente.",
    });
  }
  if (expectedAmount > 0 && paidAmount > expectedAmount + 0.01) {
    issues.push({
      field: rule.amountKey,
      message:
        "O valor pago não pode superar o valor previsto sem uma correção do lançamento.",
    });
  }
  if (
    isPartial &&
    expectedAmount > 0 &&
    paidAmount >= expectedAmount - 0.01
  ) {
    issues.push({
      field: rule.amountKey,
      message:
        "Quando o valor pago alcançar o total previsto, altere a situação para Pago.",
    });
  }
  return issues;
}

function validateActiveRule(
  payload: Record<string, unknown>,
): RecordValidationIssue[] {
  if (normalized(payload.status) !== "ativa") return [];

  const required: Array<[string, string]> = [
    ["sourceBody", "Informe o órgão ou a fonte normativa da regra ativa."],
    ["sourceUrl", "Informe o link da fonte oficial da regra ativa."],
    ["expression", "Descreva o procedimento de cálculo ou validação da regra."],
    ["testScenario", "Documente um cenário de teste antes de ativar a regra."],
    ["expectedResult", "Informe o resultado esperado do cenário de teste."],
    ["approvalEvidence", "Anexe a evidência de homologação da regra."],
    ["responsible", "Informe o responsável pela homologação da regra."],
    ["lastValidatedAt", "Informe a data da última homologação da regra."],
  ];

  return required.flatMap(([field, message]) =>
    isBlank(payload[field]) ? [{ field, message }] : [],
  );
}

function validateComplianceWorkflow(
  payload: Record<string, unknown>,
): RecordValidationIssue[] {
  const status = String(payload.status ?? "");
  const issues: RecordValidationIssue[] = [];

  if (
    [
      "Pronto para transmissão",
      "Transmitido",
      "Em processamento",
      "Processado com sucesso",
    ].includes(status) &&
    String(payload.validationStatus ?? "") !== "Validado internamente"
  ) {
    issues.push({
      field: "validationStatus",
      message:
        "Conclua a validação interna antes de preparar ou confirmar a transmissão.",
    });
  }

  if (
    [
      "Pronto para transmissão",
      "Transmitido",
      "Em processamento",
      "Processado com sucesso",
    ].includes(status) &&
    ["", "Não configurado"].includes(String(payload.certificateType ?? ""))
  ) {
    issues.push({
      field: "certificateType",
      message:
        "Informe o certificado ou a procuração responsável pela assinatura.",
    });
  }

  if (
    status === "Rejeitado" &&
    isBlank(payload.rejectionReason) &&
    isBlank(payload.notes)
  ) {
    issues.push({
      field: "rejectionReason",
      message: "Registre o motivo da rejeição para permitir a correção.",
    });
  }

  if (
    !isBlank(payload.dueDate) &&
    !isBlank(payload.competence) &&
    String(payload.dueDate) < String(payload.competence)
  ) {
    issues.push({
      field: "dueDate",
      message:
        "O prazo operacional não pode ser anterior à competência informada.",
    });
  }

  return issues;
}

function deduplicate(issues: RecordValidationIssue[]) {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = `${issue.field}:${issue.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function validateRecordPayload(
  moduleId: string,
  payload: Record<string, unknown>,
) {
  const isDemonstration = isDemonstrationPayload(payload);
  const issues = [
    ...validateCoreRecordPayload(moduleId, payload),
    ...(!isDemonstration ? validatePaymentEvidence(moduleId, payload) : []),
    ...(!isDemonstration && moduleId === "rules"
      ? validateActiveRule(payload)
      : []),
    ...(!isDemonstration && moduleId === "compliance"
      ? validateComplianceWorkflow(payload)
      : []),
  ];

  // O núcleo preserva cálculos como expectedDailyRate e as demais validações V60.
  return deduplicate(issues);
}
