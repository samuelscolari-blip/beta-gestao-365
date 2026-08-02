"use client";

import readXlsxFile from "read-excel-file/browser";
import writeXlsxFile, {
  type SheetData,
} from "write-excel-file/browser";
import {
  amountForPayload,
  isHiddenOperationalModule,
  isInternalCodeField,
  moduleDefinitions,
  normalizeHeader,
  type ModuleDefinition,
} from "./modules";
import { validateRecordPayload } from "./record-validation";
import { buildImportDeduplicationKey } from "./import-deduplication.mjs";
import {
  expandSpreadsheetDateMatrix,
  spreadsheetDateValue,
  transposeSpreadsheetRows,
} from "./spreadsheet-layout.mjs";
import { findSemanticHeaderIndex } from "./spreadsheet-semantic.mjs";
import {
  allowedImportModuleIds,
  importFamilyForModule,
  importScopeDescription,
  isImportableModule,
} from "./import-policy";

export type ImportRecord = {
  module: string;
  title: string;
  reference: string;
  status: string;
  recordDate: string;
  amount: number;
  payload: Record<string, unknown>;
  source: string;
};

type ImportLayout =
  | "Tabela vertical"
  | "Tabela horizontal"
  | "Matriz de datas";

type ParsedImportRecord = ImportRecord & {
  importLocation: string;
};

type ParsedSheet = {
  records: ParsedImportRecord[];
  skipped: number;
  matched: boolean;
  layout: ImportLayout;
};

function toDateValue(value: unknown) {
  const parsed = spreadsheetDateValue(value);
  if (parsed) return parsed;
  const text = String(value ?? "").trim();
  if (!text) return "";
  const isoWithTime = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoWithTime) return `${isoWithTime[1]}-${isoWithTime[2]}-${isoWithTime[3]}`;
  return text;
}

function cleanCell(value: unknown, type: string) {
  if (type === "date") return toDateValue(value);
  if (type === "number" || type === "currency") {
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    const text = String(value ?? "").trim();
    if (!text) return 0;
    const normalized = text
      .replace(/\s/g, "")
      .replace(/^R\$/i, "")
      .replace(/\.(?=\d{3}(?:[,.]|$))/g, "")
      .replace(",", ".");
    const number = Number(normalized);
    return Number.isFinite(number) ? number : 0;
  }
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  return String(value ?? "").trim();
}

function headerAliases(module: ModuleDefinition) {
  return module.fields.map((field) => ({
    field,
    aliases: [field.label, ...(field.aliases || [])],
  }));
}

function resolveFieldColumns(module: ModuleDefinition, header: unknown[]) {
  const usedIndexes = new Set<number>();
  return headerAliases(module)
    .map(({ field, aliases }) => {
      const index = findSemanticHeaderIndex(header, aliases, usedIndexes);
      if (index >= 0) usedIndexes.add(index);
      return {
        key: field.key,
        type: field.type,
        index,
      };
    })
    .filter((column) => column.index >= 0);
}

function createParsedRecord(
  module: ModuleDefinition,
  payload: Record<string, unknown>,
  sourceName: string,
  importLocation: string,
): ParsedImportRecord | null {
  const title = String(payload[module.titleField] || "").trim();
  if (!title) return null;
  return {
    module: module.id,
    title,
    reference: String(payload[module.referenceField] || "").trim(),
    status: String(payload[module.statusField] || "").trim(),
    recordDate: String(payload[module.dateField] || "").trim(),
    amount: amountForPayload(module, payload),
    payload,
    source: `Planilha: ${sourceName}`,
    importLocation,
  };
}

function parseConventionalTable(
  module: ModuleDefinition,
  rows: unknown[][],
  sourceName: string,
  layout: ImportLayout,
): ParsedSheet {
  let headerIndex = -1;
  let fieldColumns: Array<{ key: string; type: string; index: number }> = [];

  for (let rowIndex = 0; rowIndex < Math.min(rows.length, 25); rowIndex += 1) {
    const columns = resolveFieldColumns(module, rows[rowIndex] || []);
    if (columns.length >= 2) {
      headerIndex = rowIndex;
      fieldColumns = columns;
      break;
    }
  }

  if (headerIndex < 0) {
    return { records: [], skipped: 0, matched: false, layout };
  }

  const records: ParsedImportRecord[] = [];
  let skipped = 0;
  for (let index = headerIndex + 1; index < rows.length; index += 1) {
    const row = rows[index] || [];
    const visible = row.map((cell) => String(cell ?? "").trim());
    if (!visible.some(Boolean)) continue;
    if (visible.some((cell) => cell.toUpperCase().includes("EXEMPLO - APAGAR"))) {
      skipped += 1;
      continue;
    }

    const payload: Record<string, unknown> = {};
    for (const column of fieldColumns) {
      payload[column.key] = cleanCell(row[column.index], column.type);
    }
    const record = createParsedRecord(
      module,
      payload,
      sourceName,
      layout === "Tabela horizontal"
        ? `registro horizontal ${index - headerIndex}`
        : `linha ${index + 1}`,
    );
    if (!record) {
      skipped += 1;
      continue;
    }
    records.push(record);
  }

  return { records, skipped, matched: true, layout };
}

function parseDateMatrix(
  module: ModuleDefinition,
  rows: unknown[][],
  sourceName: string,
): ParsedSheet {
  const expanded = expandSpreadsheetDateMatrix(rows, {
    titleField: module.titleField,
    dateField: module.dateField,
    amountField: module.amountField,
    fields: module.fields,
  });

  if (!expanded.matched) {
    return {
      records: [],
      skipped: 0,
      matched: false,
      layout: "Matriz de datas",
    };
  }

  const fieldTypeByKey = new Map(
    module.fields.map((field) => [field.key, field.type]),
  );
  const records: ParsedImportRecord[] = [];
  let skipped = 0;

  for (const expandedRow of expanded.payloadRows) {
    const payload = Object.fromEntries(
      Object.entries(expandedRow.payload).map(([key, value]) => [
        key,
        cleanCell(value, fieldTypeByKey.get(key) || "text"),
      ]),
    );
    const record = createParsedRecord(
      module,
      payload,
      sourceName,
      `linha ${expandedRow.rowNumber}, coluna ${expandedRow.columnNumber}`,
    );
    if (!record) {
      skipped += 1;
      continue;
    }
    records.push(record);
  }

  return {
    records,
    skipped,
    matched: true,
    layout: "Matriz de datas",
  };
}

export function parseModuleSheet(
  module: ModuleDefinition,
  rows: unknown[][],
  sourceName: string,
): ParsedSheet {
  const matrix = parseDateMatrix(module, rows, sourceName);
  if (matrix.matched && matrix.records.length) return matrix;

  const vertical = parseConventionalTable(
    module,
    rows,
    sourceName,
    "Tabela vertical",
  );
  if (vertical.matched && vertical.records.length) return vertical;

  const horizontal = parseConventionalTable(
    module,
    transposeSpreadsheetRows(rows),
    sourceName,
    "Tabela horizontal",
  );
  if (horizontal.matched && horizontal.records.length) return horizontal;

  if (matrix.matched) return matrix;
  if (vertical.matched) return vertical;
  return horizontal;
}

function bestHeaderScore(module: ModuleDefinition, rows: unknown[][]) {
  let best = 0;
  for (const row of rows.slice(0, 25)) {
    best = Math.max(best, resolveFieldColumns(module, row).length);
  }
  return best;
}

function sheetScore(module: ModuleDefinition, rows: unknown[][]) {
  const vertical = bestHeaderScore(module, rows);
  const horizontal = bestHeaderScore(module, transposeSpreadsheetRows(rows));
  const matrix = expandSpreadsheetDateMatrix(rows, {
    titleField: module.titleField,
    dateField: module.dateField,
    amountField: module.amountField,
    fields: module.fields,
  });
  const matrixScore = matrix.matched ? 4 : 0;
  return Math.max(vertical, horizontal, matrixScore);
}

export async function importWorkbook(file: File, targetModuleId?: string) {
  if (!/\.xlsx$/i.test(file.name)) {
    throw new Error(
      "Selecione uma planilha Excel no formato .xlsx. Arquivos .xls antigos devem ser salvos novamente como .xlsx.",
    );
  }
  if (file.size > 15 * 1024 * 1024) {
    throw new Error(
      "A planilha ultrapassa 15 MB. Divida o arquivo em partes menores.",
    );
  }
  if (targetModuleId && !isImportableModule(targetModuleId)) {
    throw new Error(
      `Este módulo não aceita importação automática. O importador bônus recebe somente ${importScopeDescription}`,
    );
  }

  const sheets = await readXlsxFile(file);
  const candidates = targetModuleId
    ? moduleDefinitions.filter((module) => module.id === targetModuleId)
    : moduleDefinitions.filter((module) =>
        allowedImportModuleIds.has(module.id),
      );
  if (!candidates.length) {
    throw new Error(
      `Nenhum módulo permitido foi selecionado. O importador aceita somente ${importScopeDescription}`,
    );
  }

  const accepted: ImportRecord[] = [];
  const seen = new Set<string>();
  const report: Array<{
    family: string;
    module: string;
    sheet: string;
    layout: ImportLayout;
    imported: number;
    skipped: number;
    invalid: number;
    duplicates: number;
    confidence: number;
    detected: boolean;
    invalidExamples: string[];
  }> = [];
  const unmatchedSheets: string[] = [];

  for (const sheet of sheets) {
    const sheetRows = sheet.data as unknown[][];
    const direct = candidates.find((module) =>
      module.spreadsheetSheets.some(
        (name) => normalizeHeader(name) === normalizeHeader(sheet.sheet),
      ),
    );
    const scored = candidates
      .map((module) => ({ module, score: sheetScore(module, sheetRows) }))
      .sort((a, b) => b.score - a.score);
    const selected =
      direct || (scored[0]?.score >= 2 ? scored[0].module : undefined);
    if (!selected) {
      unmatchedSheets.push(sheet.sheet);
      continue;
    }

    const parsed = parseModuleSheet(
      selected,
      sheetRows,
      `${file.name} / ${sheet.sheet}`,
    );
    let invalid = 0;
    let duplicates = 0;
    let imported = 0;
    const invalidExamples: string[] = [];

    for (const parsedRecord of parsed.records) {
      const { importLocation, ...record } = parsedRecord;
      const issues = validateRecordPayload(record.module, record.payload);
      if (issues.length) {
        invalid += 1;
        if (invalidExamples.length < 8) {
          invalidExamples.push(
            `${importLocation}: ${issues
              .map((issue) => `${issue.field}: ${issue.message}`)
              .join("; ")}`,
          );
        }
        continue;
      }

      const key = buildImportDeduplicationKey(record);
      if (seen.has(key)) {
        duplicates += 1;
        continue;
      }
      seen.add(key);
      accepted.push(record);
      imported += 1;
      if (accepted.length > 10_000) {
        throw new Error(
          "A importação ultrapassa 10.000 registros. Divida a planilha em arquivos menores.",
        );
      }
    }

    const bestScore = direct
      ? Math.max(2, sheetScore(selected, sheetRows))
      : scored[0]?.score || 0;
    const confidence = Math.min(
      100,
      Math.round((bestScore / Math.max(2, Math.min(6, selected.fields.length))) * 100),
    );
    report.push({
      family: importFamilyForModule(selected.id)?.label || "Não classificado",
      module: selected.label,
      sheet: sheet.sheet,
      layout: parsed.layout,
      imported,
      skipped: parsed.skipped,
      invalid,
      duplicates,
      confidence,
      detected: !direct,
      invalidExamples,
    });
  }

  return { records: accepted, report, unmatchedSheets };
}

function excelCell(value: unknown, fieldType: string) {
  if (fieldType === "currency") {
    return {
      value: Number(value || 0),
      type: Number,
      format: 'R$ #,##0.00',
    };
  }
  if (fieldType === "number") {
    return { value: Number(value || 0), type: Number };
  }
  return String(value ?? "");
}

export async function exportModuleWorkbook(
  module: ModuleDefinition,
  records: Array<{ payload: Record<string, unknown> }>,
) {
  const exportFields = module.fields.filter(
    (field) => !isInternalCodeField(module, field.key),
  );
  const header = exportFields.map((field) => ({
    value: field.label,
    fontWeight: "bold" as const,
    textColor: "#ffffff",
    backgroundColor: "#17324d",
    wrap: true,
  }));
  const rows = records.map((record) =>
    exportFields.map((field) =>
      excelCell(record.payload[field.key], field.type),
    ),
  );
  const data = [header, ...rows] as SheetData;
  await writeXlsxFile(data, {
    columns: exportFields.map((field) => ({
      width: field.wide ? 32 : Math.max(14, Math.min(24, field.label.length + 4)),
    })),
    stickyRowsCount: 1,
  }).toFile(
    `Beta_Construtora_${module.shortLabel.replace(/\s+/g, "_")}_${new Date()
      .toISOString()
      .slice(0, 10)}.xlsx`,
  );
}

export async function exportAllWorkbook(
  records: Array<{ module: string; payload: Record<string, unknown> }>,
) {
  const sheets = moduleDefinitions
    .filter(
      (module) =>
        module.id !== "m365" && !isHiddenOperationalModule(module.id),
    )
    .map((module) => {
      const moduleRows = records.filter((record) => record.module === module.id);
      const exportFields = module.fields.filter(
        (field) => !isInternalCodeField(module, field.key),
      );
      const header = exportFields.map((field) => ({
        value: field.label,
        fontWeight: "bold" as const,
        textColor: "#ffffff",
        backgroundColor: "#17324d",
        wrap: true,
      }));
      return {
        sheet: module.shortLabel.slice(0, 31),
        data: [
          header,
          ...moduleRows.map((record) =>
            exportFields.map((field) =>
              excelCell(record.payload[field.key], field.type),
            ),
          ),
        ] as SheetData,
        columns: exportFields.map((field) => ({
          width: field.wide
            ? 32
            : Math.max(14, Math.min(24, field.label.length + 4)),
        })),
        stickyRowsCount: 1,
      };
    });

  await writeXlsxFile(sheets).toFile(
    `Beta_Construtora_Backup_Gestao_365_${new Date()
      .toISOString()
      .slice(0, 10)}.xlsx`,
  );
}
