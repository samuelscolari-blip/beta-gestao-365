/**
 * @typedef {Object} ImportLikeRecord
 * @property {string} module
 * @property {string} title
 * @property {string} reference
 * @property {string} recordDate
 * @property {number} amount
 * @property {Record<string, unknown>} payload
 * @property {string} source
 */

/**
 * Normaliza valores apenas para comparação técnica de linhas importadas.
 * Valores monetários iguais continuam iguais, mas nunca são usados sozinhos.
 * @param {unknown} value
 */
function normalizeDeduplicationValue(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "";
  }
  if (typeof value === "boolean") return value ? "true" : "false";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  return String(value)
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/**
 * Considera todos os campos efetivamente preenchidos na linha.
 * Assim, R$ 60,20 de Matheus e R$ 60,20 de Carlos geram chaves diferentes.
 * @param {Record<string, unknown>} payload
 */
function canonicalImportPayload(payload) {
  return JSON.stringify(
    Object.entries(payload)
      .map(([key, value]) => [key, normalizeDeduplicationValue(value)])
      .filter(([, value]) => value !== "")
      .sort(([left], [right]) => left.localeCompare(right)),
  );
}

/**
 * Para linhas sem identificador único, limita a deduplicação automática
 * à mesma aba. Linhas iguais em abas distintas são mantidas para revisão.
 * @param {string} source
 */
function sourceSheetKey(source) {
  const separator = " / ";
  const sheet = source.includes(separator)
    ? source.slice(source.lastIndexOf(separator) + separator.length)
    : source;
  return normalizeDeduplicationValue(sheet);
}

/**
 * Regras:
 * 1. Com referência única: a referência identifica duplicidade entre abas.
 * 2. Sem referência: somente uma linha integralmente idêntica na mesma aba
 *    recebe a mesma chave.
 *
 * @param {ImportLikeRecord} record
 */
export function buildImportDeduplicationKey(record) {
  const reference = normalizeDeduplicationValue(record.reference);
  if (reference) return `${record.module}::ref::${reference}`;

  return [
    record.module,
    "sheet",
    sourceSheetKey(record.source),
    "row",
    canonicalImportPayload(record.payload),
  ].join("::");
}
