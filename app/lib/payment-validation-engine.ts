export type PaymentValidationIssue = {
  field: string;
  message: string;
};

export type PaymentEvidenceRule = {
  statusKey: string;
  dateKey: string;
  amountKey: string;
  proofKey: string;
  expectedKeys: string[];
};

function normalized(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function numberValue(payload: Record<string, unknown>, key: string) {
  const value = Number(payload[key]);
  return Number.isFinite(value) ? value : 0;
}

function firstPositiveAlias(
  payload: Record<string, unknown>,
  keys: string[],
) {
  return keys
    .map((key) => numberValue(payload, key))
    .find((value) => value > 0) || 0;
}

function isBlank(value: unknown) {
  return value === null || value === undefined || String(value).trim() === "";
}

function validHttpUrl(value: unknown) {
  try {
    const parsed = new URL(String(value));
    return ["http:", "https:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}

export class PaymentValidationEngine {
  static calculateExpectedTotal(
    moduleId: string,
    payload: Record<string, unknown>,
    rule: PaymentEvidenceRule,
  ) {
    if (moduleId === "rentals") {
      const declaredTotal = numberValue(payload, "totalMonthly");
      if (declaredTotal > 0) return declaredTotal;

      const rent = firstPositiveAlias(payload, ["monthlyRent", "rentAmount"]);
      const energy = firstPositiveAlias(payload, ["energy", "electricity"]);
      return (
        rent +
        numberValue(payload, "water") +
        energy +
        numberValue(payload, "internet")
      );
    }

    return firstPositiveAlias(payload, rule.expectedKeys);
  }

  static audit(
    moduleId: string,
    payload: Record<string, unknown>,
    rule: PaymentEvidenceRule,
  ): PaymentValidationIssue[] {
    const status = normalized(payload[rule.statusKey]);
    const isPaid = status === "pago" || status === "paga";
    const isPartial = status === "parcial";
    if (!isPaid && !isPartial) return [];

    const issues: PaymentValidationIssue[] = [];
    const paidAmount = numberValue(payload, rule.amountKey);
    const expectedAmount = this.calculateExpectedTotal(moduleId, payload, rule);
    const proof = payload[rule.proofKey];

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

    if (isBlank(proof)) {
      issues.push({
        field: rule.proofKey,
        message: isPaid
          ? "Anexe ou informe o link do comprovante antes de marcar o item como Pago."
          : "Anexe ou informe o link do comprovante do pagamento parcial.",
      });
    } else if (!validHttpUrl(proof)) {
      issues.push({
        field: rule.proofKey,
        message:
          "O comprovante deve usar um link completo iniciado por http ou https.",
      });
    }

    if (isPaid && expectedAmount > 0 && paidAmount < expectedAmount - 0.01) {
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

    if (isPartial && expectedAmount > 0 && paidAmount >= expectedAmount - 0.01) {
      issues.push({
        field: rule.amountKey,
        message:
          "Quando o valor pago alcançar o total previsto, altere a situação para Pago.",
      });
    }

    return issues;
  }
}
