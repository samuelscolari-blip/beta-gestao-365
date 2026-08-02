export type ApprovedDecisionRecord = {
  module: string;
  status: string;
  amount: number;
  payload: Record<string, unknown>;
};

export const approvedDecisionModules = new Set([
  "purchases",
  "expenses",
  "cards",
  "rentals",
]);

export const approvedDecisionModuleLabels: Record<string, string> = {
  purchases: "Compras",
  expenses: "Contas a pagar",
  cards: "Cartão corporativo",
  rentals: "Aluguéis",
};

function normalizedDecision(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export function isApprovedDecision(record: ApprovedDecisionRecord) {
  return [
    record.payload.managementDecision,
    record.payload.approval,
    record.status,
  ].some((value) =>
    ["aprovado", "aprovada"].includes(normalizedDecision(value)),
  );
}

export function approvedDecisionAmount(record: ApprovedDecisionRecord) {
  const payload = record.payload;
  const rentalTotal =
    Number(payload.totalMonthly || 0) ||
    Number(payload.monthlyRent || 0) +
      Number(payload.water || 0) +
      Number(payload.energy || 0) +
      Number(payload.internet || 0);
  const value =
    record.module === "purchases"
      ? payload.totalAmount
      : record.module === "expenses"
        ? payload.expectedAmount
        : record.module === "cards"
          ? payload.amount
          : record.module === "rentals"
            ? rentalTotal
            : record.amount;
  const amount = Number(value ?? record.amount ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}
