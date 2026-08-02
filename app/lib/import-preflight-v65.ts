"use client";

import readXlsxFile from "read-excel-file/browser";
import {
  moduleDefinitions,
  normalizeHeader,
  type ModuleDefinition,
} from "./modules";
import {
  allowedImportModuleIds,
  importFamilyForModule,
} from "./import-policy";
import { parseCsvRows } from "./spreadsheet-csv.mjs";
import { parseModuleSheet } from "./spreadsheet";
import "./v65-module-enhancements";

type SheetData = { sheet: string; data: unknown[][] };

type Candidate = {
  module: ModuleDefinition;
  score: number;
  records: number;
  invalid: number;
  layout: string;
};

export type ImportPreflightResult = {
  kind: "clear" | "warning" | "error";
  title: string;
  message: string;
  details: string[];
};

function directModule(sheetName: string, candidates: ModuleDefinition[]) {
  return candidates.find((module) =>
    module.spreadsheetSheets.some(
      (name) => normalizeHeader(name) === normalizeHeader(sheetName),
    ),
  );
}

function candidateFor(
  module: ModuleDefinition,
  rows: unknown[][],
  sourceName: string,
): Candidate {
  const parsed = parseModuleSheet(module, rows, sourceName);
  const records = parsed.records.length;
  const invalid = parsed.failures.length;
  const score = Math.max(
    0,
    records * 6 + (parsed.matched ? 4 : 0) - Math.min(20, invalid * 2),
  );
  return {
    module,
    score,
    records,
    invalid,
    layout: parsed.layout,
  };
}

async function workbookSheets(file: File): Promise<SheetData[]> {
  if (/\.csv$/i.test(file.name)) {
    return [
      {
        sheet: file.name.replace(/\.csv$/i, "").slice(0, 31) || "CSV",
        data: parseCsvRows(await file.text()),
      },
    ];
  }
  return (await readXlsxFile(file)) as SheetData[];
}

export async function inspectImportFileV65(
  file: File,
): Promise<ImportPreflightResult> {
  if (!/\.(?:xlsx|csv)$/i.test(file.name)) {
    return {
      kind: "error",
      title: "Formato não aceito",
      message:
        "Selecione uma planilha .xlsx ou .csv. Arquivos .xls antigos precisam ser salvos novamente como .xlsx.",
      details: [],
    };
  }
  if (file.size > 15 * 1024 * 1024) {
    return {
      kind: "error",
      title: "Arquivo muito grande",
      message: "A planilha ultrapassa 15 MB e deve ser dividida em partes menores.",
      details: [],
    };
  }

  const sheets = await workbookSheets(file);
  const candidates = moduleDefinitions.filter((module) =>
    allowedImportModuleIds.has(module.id),
  );
  const details: string[] = [];
  const ambiguities: string[] = [];
  const unrecognized: string[] = [];
  let recognized = 0;

  for (const sheet of sheets) {
    const rows = sheet.data || [];
    const visibleRows = rows.filter((row) =>
      (row || []).some((cell) => String(cell ?? "").trim()),
    );
    if (!visibleRows.length) {
      details.push(`${sheet.sheet}: aba vazia, será ignorada.`);
      continue;
    }

    const direct = directModule(sheet.sheet, candidates);
    if (direct) {
      const parsed = candidateFor(
        direct,
        rows,
        `${file.name} / ${sheet.sheet}`,
      );
      recognized += 1;
      details.push(
        `${sheet.sheet}: ${direct.label} • ${parsed.layout} • ${parsed.records} registro(s) identificado(s).`,
      );
      continue;
    }

    const ranked = candidates
      .map((module) =>
        candidateFor(module, rows, `${file.name} / ${sheet.sheet}`),
      )
      .filter((candidate) => candidate.records > 0 || candidate.score > 4)
      .sort((a, b) => b.score - a.score);
    const first = ranked[0];
    const second = ranked[1];

    if (!first || first.score <= 4) {
      unrecognized.push(sheet.sheet);
      continue;
    }

    recognized += 1;
    const family = importFamilyForModule(first.module.id)?.label || first.module.label;
    details.push(
      `${sheet.sheet}: provável ${family} / ${first.module.label} • ${first.layout} • ${first.records} registro(s).`,
    );

    if (
      second &&
      second.score > 4 &&
      second.score >= first.score * 0.82 &&
      second.module.id !== first.module.id
    ) {
      ambiguities.push(
        `${sheet.sheet}: pode ser “${first.module.label}” ou “${second.module.label}”.`,
      );
    }
  }

  if (!recognized) {
    return {
      kind: "error",
      title: "Dados não reconhecidos",
      message:
        "Nenhuma aba apresentou cabeçalhos suficientes para uma importação segura. Confira os títulos das colunas ou escolha o módulo manualmente.",
      details: unrecognized.map((sheet) => `${sheet}: estrutura não reconhecida.`),
    };
  }

  if (ambiguities.length || unrecognized.length) {
    return {
      kind: "warning",
      title: "Revisão necessária antes de importar",
      message:
        "O sistema encontrou abas ambíguas ou não reconhecidas. Revise a identificação abaixo; ao continuar, a prévia normal ainda mostrará linhas válidas, rejeitadas e duplicadas antes da gravação.",
      details: [
        ...ambiguities,
        ...unrecognized.map((sheet) => `${sheet}: estrutura não reconhecida e será ignorada.`),
        ...details,
      ],
    };
  }

  return {
    kind: "clear",
    title: "Planilha reconhecida",
    message:
      "A estrutura passou pela pré-validação. A próxima etapa exibirá a prévia detalhada antes de gravar os registros.",
    details,
  };
}
