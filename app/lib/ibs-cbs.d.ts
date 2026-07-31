export const IBS_CBS_RULES_VERSION: string;
export const IBS_CBS_DEFAULTS: {
  effectiveFrom: string;
  effectiveTo: string;
  ibsStateRate: number;
  ibsMunicipalRate: number;
  ibsRate: number;
  cbsRate: number;
  testYear: number;
};
export function roundMoney(value: unknown): number;
export function roundRate(value: unknown): number;
export function normalizeCompetence(value: unknown): string;
export function isValidFiscalKey(value: unknown): boolean;
export function isValidIbsCbsCst(value: unknown): boolean;
export function isValidCClassTrib(value: unknown): boolean;
export function isCompatibleCstAndCClassTrib(
  cst: unknown,
  cClassTrib: unknown,
): boolean;
export function isIbsCbsApplicable(config?: Record<string, unknown>, reference?: string): boolean;
export function ibsCbsApplicabilityReason(config?: Record<string, unknown>, reference?: string): string;
export function calculateIbsCbs(input?: Record<string, unknown>): Record<string, unknown>;
export function validateFiscalDocument(document?: Record<string, unknown>, config?: Record<string, unknown>, duplicateKeys?: string[]): {
  applicable: boolean;
  applicabilityReason: string;
  issues: Array<{ code: string; severity: "critical" | "warning"; message: string; field: string }>;
  calculation: Record<string, unknown>;
  criticalCount: number;
  warningCount: number;
  status: string;
};
export function calculateAssessment(
  documents?: Array<Record<string, unknown>>,
  competence?: string,
): Record<string, unknown>;
