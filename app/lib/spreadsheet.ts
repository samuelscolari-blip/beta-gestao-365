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

function toDateValue(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const text = String(value ?? "").trim();
  if (!text) return "";
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = text.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return text;
}

function cleanCell(value: unknown, type: string) {
  if (type === "date") return toDateValue(value);
  if (type === "number" || type === "currency") {
    if (typeof value === "number") return value;
    const normalized = String(value ?? "")
      .replace(/\s/g, "")
      .replace(/^R\$/, "")
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
    normalized: [field.label, ...(field.aliases || [])].map(normalizeHeader),
  }));
}

export function parseModuleSheet(
  module: ModuleDefinition,
  rows: unknown[][],
  sourceName: string,
) {
  const aliases = headerAliases(module);
  let headerIndex = -1;
  let fieldColumns: Array<{ key: string; type: string; index: number }> = [];

  for (let rowIndex = 0; rowIndex < Math.min(rows.length, 25); rowIndex += 1) {
    const normalizedRow = rows[rowIndex].map(normalizeHeader);
    const columns = aliases
      .map(({ field, normalized }) => ({
        key: field.key,
        type: field.type,
        index: normalizedRow.findIndex((header) => normalized.includes(header)),
      }))
      .filter((column) => column.index >= 0);
    if (columns.length >= 2) {
      headerIndex = rowIndex;
      fieldColumns = columns;
      break;
    }
  }

  if (headerIndex < 0) {
    return { records: [] as ImportRecord[], skipped: 0, matched: false };
  }

  const records: ImportRecord[] = [];
  let skipped = 0;
  for (const row of rows.slice(headerIndex + 1)) {
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
    const title = String(payload[module.titleField] || "").trim();
    if (!title) {
      skipped += 1;
      continue;
    }
    records.push({
      module: module.id,
      title,
      reference: String(payload[module.referenceField] || "").trim(),
      status: String(payload[module.statusField] || "").trim(),
      recordDate: String(payload[module.dateField] || "").trim(),
      amount: amountForPayload(module, payload),
      payload,
      source: `Planilha: ${sourceName}`,
    });
  }
  return { records, skipped, matched: true };
}

export async function importWorkbook(file: File, targetModuleId?: string) {
  const sheets = await readXlsxFile(file);
  const targets = targetModuleId
    ? moduleDefinitions.filter((module) => module.id === targetModuleId)
    : moduleDefinitions.filter((module) => module.spreadsheetSheets.length);

  const records: ImportRecord[] = [];
  const report: Array<{
    module: string;
    sheet: string;
    imported: number;
    skipped: number;
  }> = [];

  for (const targetModule of targets) {
    const sheet = sheets.find((candidate) =>
      targetModule.spreadsheetSheets.some(
        (name) => normalizeHeader(name) === normalizeHeader(candidate.sheet),
      ),
    );
    if (!sheet) continue;
    const parsed = parseModuleSheet(
      targetModule,
      sheet.data as unknown[][],
      `${file.name} / ${sheet.sheet}`,
    );
    records.push(...parsed.records);
    report.push({
      module: targetModule.label,
      sheet: sheet.sheet,
      imported: parsed.records.length,
      skipped: parsed.skipped,
    });
  }
  return { records, report };
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
