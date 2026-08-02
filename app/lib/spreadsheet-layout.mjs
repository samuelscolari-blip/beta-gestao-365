import { findSemanticHeaderIndex } from "./spreadsheet-semantic.mjs";

function normalizeLayoutText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function spreadsheetDateValue(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  if (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 20_000 &&
    value <= 80_000
  ) {
    const timestamp = Math.round((value - 25569) * 86_400_000);
    const date = new Date(timestamp);
    if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
  }

  const text = String(value ?? "").trim();
  if (!text) return "";

  const iso = text.match(/^(\d{4})[-/.](\d{2})[-/.](\d{2})$/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const brazilian = text.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/);
  if (brazilian) {
    return `${brazilian[3]}-${brazilian[2].padStart(2, "0")}-${brazilian[1].padStart(2, "0")}`;
  }

  return "";
}

export function transposeSpreadsheetRows(rows) {
  const width = rows.reduce(
    (maximum, row) => Math.max(maximum, Array.isArray(row) ? row.length : 0),
    0,
  );

  return Array.from({ length: width }, (_, columnIndex) =>
    rows.map((row) => (Array.isArray(row) ? row[columnIndex] ?? "" : "")),
  );
}

function fieldAliases(fields) {
  return fields.map((field) => ({
    key: field.key,
    aliases: [field.label, ...(field.aliases || [])],
  }));
}

/**
 * Expande planilhas em formato de matriz:
 * Pessoa | Obra | 03/08/2026 | 04/08/2026 | 05/08/2026
 * Matheus | A    | 60,20      | 60,20      | 60,20
 *
 * Também aceita matrizes esparsas ou visualmente diagonais: cada célula
 * preenchida sob uma coluna de data vira um lançamento independente.
 */
export function expandSpreadsheetDateMatrix(rows, config) {
  if (!config.amountField || !config.dateField || !config.titleField) {
    return { matched: false, payloadRows: [], headerIndex: -1 };
  }

  const aliases = fieldAliases(config.fields || []);
  const searchLimit = Math.min(rows.length, 25);

  for (let headerIndex = 0; headerIndex < searchLimit; headerIndex += 1) {
    const header = Array.isArray(rows[headerIndex]) ? rows[headerIndex] : [];
    const dateColumns = header
      .map((value, index) => ({ index, date: spreadsheetDateValue(value) }))
      .filter((entry) => entry.date);

    if (dateColumns.length < 2) continue;

    const usedIndexes = new Set(dateColumns.map((column) => column.index));
    const baseColumns = [];
    for (const field of aliases) {
      const index = findSemanticHeaderIndex(header, field.aliases, usedIndexes);
      if (index >= 0) {
        baseColumns.push({ key: field.key, index });
        usedIndexes.add(index);
      }
    }

    if (!baseColumns.some((column) => column.key === config.titleField)) continue;

    const payloadRows = [];
    for (let rowIndex = headerIndex + 1; rowIndex < rows.length; rowIndex += 1) {
      const row = Array.isArray(rows[rowIndex]) ? rows[rowIndex] : [];
      const basePayload = Object.fromEntries(
        baseColumns.map((column) => [column.key, row[column.index] ?? ""]),
      );
      const title = String(basePayload[config.titleField] ?? "").trim();
      if (!title) continue;

      for (const dateColumn of dateColumns) {
        const rawAmount = row[dateColumn.index];
        const visibleAmount = String(rawAmount ?? "").trim();
        if (!visibleAmount) continue;

        payloadRows.push({
          payload: {
            ...basePayload,
            [config.dateField]: dateColumn.date,
            [config.amountField]: rawAmount,
          },
          rowNumber: rowIndex + 1,
          columnNumber: dateColumn.index + 1,
        });
      }
    }

    return {
      matched: true,
      payloadRows,
      headerIndex,
    };
  }

  return { matched: false, payloadRows: [], headerIndex: -1 };
}
