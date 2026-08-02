"use client";

import readXlsxFile from "read-excel-file/browser";
import {
  moduleDefinitions,
} from "./modules";
import {
  allowedImportModuleIds,
  importFamilyForModule,
} from "./import-policy";
import { parseCsvRows } from "./spreadsheet-csv.mjs";
import { resolveImportSheet } from "./spreadsheet";
import "./v65-module-enhancements";

type SheetData = { sheet: string; data: unknown[][] };

export type ImportPreflightResult = {
  kind: "clear" | "warning" | "error";
  title: string;
  message: string;
  details: string[];
};

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

    const resolution = resolveImportSheet(
      candidates,
      rows,
      sheet.sheet,
      `${file.name} / ${sheet.sheet}`,
    );
    if (resolution.ambiguous) {
      ambiguities.push(resolution.reason || `${sheet.sheet}: identificação ambígua.`);
      continue;
    }
    const selected = resolution.selected;
    if (!selected) {
      unrecognized.push(sheet.sheet);
      continue;
    }
    recognized += 1;
    const candidate = resolution.ranked.find(
      (item) => item.module.id === selected.id,
    );
    const family = importFamilyForModule(selected.id)?.label || selected.label;
    details.push(
      `${sheet.sheet}: ${family} / ${selected.label} • ${candidate?.layout || "Tabela vertical"} • ${candidate?.records || 0} registro(s).`,
    );
  }

  if (ambiguities.length) {
    return {
      kind: "error",
      title: "Escolha manual do módulo necessária",
      message:
        "O conteúdo corresponde a mais de um módulo. Para evitar gravação incorreta, selecione o módulo de destino e importe novamente.",
      details: [...ambiguities, ...details],
    };
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

  if (unrecognized.length) {
    return {
      kind: "warning",
      title: "Revisão necessária antes de importar",
      message:
        "O sistema encontrou abas ambíguas ou não reconhecidas. Revise a identificação abaixo; ao continuar, a prévia normal ainda mostrará linhas válidas, rejeitadas e duplicadas antes da gravação.",
      details: [
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
