import { spreadsheetDateValue } from "./spreadsheet-layout.mjs";

export class SpreadsheetCellError extends Error {
  constructor(message, code, value) {
    super(message);
    this.name = "SpreadsheetCellError";
    this.code = code;
    this.value = value;
  }
}

function blank(value) {
  return value === null || value === undefined || String(value).trim() === "";
}

function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Converte datas reais, seriais plausíveis do Excel, ISO e DD/MM/AAAA.
 * Números pequenos nunca são tratados como datas seriais.
 */
export function sanitizeSpreadsheetDate(value) {
  if (blank(value)) return "";
  const parsed = spreadsheetDateValue(value);
  const date = parsed ? new Date(`${parsed}T00:00:00Z`) : null;
  if (
    !parsed ||
    !date ||
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== parsed
  ) {
    throw new SpreadsheetCellError(
      `Formato de data inválido: ${String(value).slice(0, 80)}`,
      "INVALID_SPREADSHEET_DATE",
      value,
    );
  }
  return parsed;
}

/**
 * Aceita valores numéricos e formatos monetários brasileiros ou internacionais
 * sem transformar silenciosamente uma célula inválida em zero.
 */
export function sanitizeSpreadsheetMoney(value) {
  if (blank(value)) return 0;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new SpreadsheetCellError(
        "Valor monetário inválido.",
        "INVALID_SPREADSHEET_MONEY",
        value,
      );
    }
    return roundMoney(value);
  }

  let text = String(value)
    .normalize("NFKC")
    .replace(/\s/g, "")
    .replace(/^(?:R\$|BRL|US\$|USD)/i, "")
    .trim();
  const negativeByParentheses = /^\(.*\)$/.test(text);
  if (negativeByParentheses) text = text.slice(1, -1);
  text = text.replace(/[^0-9,.-]/g, "");

  const comma = text.lastIndexOf(",");
  const dot = text.lastIndexOf(".");
  if (comma >= 0 && dot >= 0) {
    const decimal = comma > dot ? "," : ".";
    const thousands = decimal === "," ? /\./g : /,/g;
    text = text.replace(thousands, "").replace(decimal, ".");
  } else if (comma >= 0) {
    text = text.replace(/\./g, "").replace(",", ".");
  } else if (dot >= 0) {
    const groups = text.split(".");
    const finalGroup = groups.at(-1) || "";
    if (groups.length > 2 || finalGroup.length === 3) {
      text = groups.join("");
    }
  }

  if (negativeByParentheses) text = `-${text}`;
  if (!/^-?\d+(?:\.\d+)?$/.test(text)) {
    throw new SpreadsheetCellError(
      `Formato monetário inválido: ${String(value).slice(0, 80)}`,
      "INVALID_SPREADSHEET_MONEY",
      value,
    );
  }
  const parsed = Number(text);
  if (!Number.isFinite(parsed)) {
    throw new SpreadsheetCellError(
      "Valor monetário fora do limite aceito.",
      "INVALID_SPREADSHEET_MONEY",
      value,
    );
  }
  return roundMoney(parsed);
}

export function sanitizeSpreadsheetNumber(value) {
  if (blank(value)) return 0;
  const parsed = sanitizeSpreadsheetMoney(value);
  if (!Number.isFinite(parsed)) {
    throw new SpreadsheetCellError(
      `Formato numérico inválido: ${String(value).slice(0, 80)}`,
      "INVALID_SPREADSHEET_NUMBER",
      value,
    );
  }
  return parsed;
}

export function sanitizeSpreadsheetCell(value, type) {
  if (type === "date") return sanitizeSpreadsheetDate(value);
  if (type === "currency") return sanitizeSpreadsheetMoney(value);
  if (type === "number") return sanitizeSpreadsheetNumber(value);
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  return String(value ?? "")
    .normalize("NFKC")
    .trim();
}
