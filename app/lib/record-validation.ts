import "./v65-module-enhancements";
import { PaymentValidationEngine } from "./payment-validation-engine";
import { FiscalComplianceGuardian } from "./fiscal-compliance-guardian";
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
  cards: { statusKey: "status", dateKey: "paymentDate", amountKey: "paidAmount", proofKey: "receiptUrl", expectedKeys: ["amount"] },
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

function validatePaymentEvidence(
  moduleId: string,
  payload: Record<string, unknown>,
): RecordValidationIssue[] {
  const rule = paymentEvidenceRules[moduleId];
  return rule ? PaymentValidationEngine.audit(moduleId, payload, rule) : [];
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
  return FiscalComplianceGuardian.verify(payload);
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
