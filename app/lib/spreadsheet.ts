"use client";

import readXlsxFile from "read-excel-file/browser";
import writeXlsxFile, {
  type SheetData,
} from "write-excel-file/browser";
import {
  amountForPayload,
  isInternalCodeField,
  moduleDefinitions,
  normalizeHeader,
  type ModuleDefinition,
  type ModuleField,
} from "./modules";
import { validateRecordPayload } from "./record-validation";
import { SheetAnalyzer } from "./sheet-analyzer";
import { buildImportDeduplicationKey } from "./import-deduplication.mjs";
import { parseCsvRows } from "./spreadsheet-csv.mjs";
import {
  expandSpreadsheetDateMatrix,
  transposeSpreadsheetRows,
} from "./spreadsheet-layout.mjs";
import { normalizeSemanticHeaders } from "./spreadsheet-semantic.mjs";
import { sanitizeSpreadsheetCell } from "./spreadsheet-sanitizer.mjs";
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
  importLocation?: string;
  importSheet?: string;
};

type ImportLayout =
  | "Tabela vertical"
  | "Tabela horizontal"
  | "Matriz de datas";

type ParsedImportRecord = ImportRecord & {
  importLocation: string;
};

export type ImportFailure = {
  module: string;
  sheet: string;
  location: string;
  reason: string;
  payload: Record<string, unknown>;
};

type ParsedFailure = Omit<ImportFailure, "module" | "sheet">;

type ParsedSheet = {
  records: ParsedImportRecord[];
  skipped: number;
  matched: boolean;
  layout: ImportLayout;
  failures: ParsedFailure[];
};

function cleanCell(value: unknown, type: string) {
  return sanitizeSpreadsheetCell(value, type);
}

function hasSpreadsheetValue(value: unknown) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function resolveFieldColumns(module: ModuleDefinition, header: unknown[]) {
  const fieldByKey = new Map(module.fields.map((field) => [field.key, field]));
  return normalizeSemanticHeaders(header, module.fields).flatMap(
    (key: string | null, index: number) => {
      if (!key) return [];
      const field = fieldByKey.get(key);
      return field ? [{ key, type: field.type, index }] : [];
    },
  );
}

function createParsedRecord(
  module: ModuleDefinition,
  payload: Record<string, unknown>,
  sourceName: string,
  importLocation: string,
): ParsedImportRecord | null {
  const title = String(
    payload[module.titleField] ||
      (module.id === "works" ? payload.code : "") ||
      "",
  ).trim();
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
    importSheet: sourceName.split(" / ").at(-1) || sourceName,
  };
}

function rawRowPayload(header: unknown[], row: unknown[]) {
  return Object.fromEntries(
    header.map((value, index) => [
      String(value || `coluna_${index + 1}`).slice(0, 120),
      row[index] ?? "",
    ]),
  );
}

function failureReason(error: unknown) {
  return error instanceof Error
    ? error.message
    : "A linha não pôde ser sanitizada.";
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
    return { records: [], skipped: 0, matched: false, layout, failures: [] };
  }

  const records: ParsedImportRecord[] = [];
  const failures: ParsedFailure[] = [];
  let skipped = 0;
  for (let index = headerIndex + 1; index < rows.length; index += 1) {
    const row = rows[index] || [];
    const visible = row.map((cell) => String(cell ?? "").trim());
    if (!visible.some(Boolean)) continue;
    if (visible.some((cell) => cell.toUpperCase().includes("EXEMPLO - APAGAR"))) {
      skipped += 1;
      continue;
    }

    const importLocation = layout === "Tabela horizontal"
      ? `registro horizontal ${index - headerIndex}`
      : `linha ${index + 1}`;
    const rawPayload = rawRowPayload(rows[headerIndex] || [], row);
    try {
      const payload: Record<string, unknown> = {};
      for (const column of fieldColumns) {
        const rawValue = row[column.index];
        if (!hasSpreadsheetValue(rawValue)) continue;
        payload[column.key] = cleanCell(rawValue, column.type);
      }
      const record = createParsedRecord(
        module,
        payload,
        sourceName,
        importLocation,
      );
      if (!record) {
        failures.push({
          location: importLocation,
          reason: `O campo “${module.fields.find((field) => field.key === module.titleField)?.label || "título"}” não foi identificado.`,
          payload: rawPayload,
        });
        continue;
      }
      records.push(record);
    } catch (error) {
      failures.push({
        location: importLocation,
        reason: failureReason(error),
        payload: rawPayload,
      });
    }
  }

  return { records, skipped, matched: true, layout, failures };
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
      failures: [],
    };
  }

  const fieldTypeByKey = new Map(
    module.fields.map((field) => [field.key, field.type]),
  );
  const records: ParsedImportRecord[] = [];
  const failures: ParsedFailure[] = [];
  const skipped = 0;

  for (const expandedRow of expanded.payloadRows) {
    const importLocation =
      `linha ${expandedRow.rowNumber}, coluna ${expandedRow.columnNumber}`;
    try {
      const payload = Object.fromEntries(
        Object.entries(expandedRow.payload).flatMap(([key, value]) =>
          hasSpreadsheetValue(value)
            ? [[key, cleanCell(value, fieldTypeByKey.get(key) || "text")]]
            : [],
        ),
      );
      const record = createParsedRecord(
        module,
        payload,
        sourceName,
        importLocation,
      );
      if (!record) {
        failures.push({
          location: importLocation,
          reason: `O campo “${module.fields.find((field) => field.key === module.titleField)?.label || "título"}” não foi identificado.`,
          payload: expandedRow.payload,
        });
        continue;
      }
      records.push(record);
    } catch (error) {
      failures.push({
        location: importLocation,
        reason: failureReason(error),
        payload: expandedRow.payload,
      });
    }
  }

  return {
    records,
    skipped,
    matched: true,
    layout: "Matriz de datas",
    failures,
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

export type ImportSheetCandidate = {
  module: ModuleDefinition;
  score: number;
  headerScore: number;
  records: number;
  invalid: number;
  layout: ImportLayout;
};

export type ImportSheetResolution = {
  direct?: ModuleDefinition;
  selected?: ModuleDefinition;
  ranked: ImportSheetCandidate[];
  ambiguous: boolean;
  reason?: string;
};

export function resolveImportSheet(
  candidates: ModuleDefinition[],
  rows: unknown[][],
  sheetName: string,
  sourceName: string,
): ImportSheetResolution {
  const direct = candidates.find((module) =>
    module.spreadsheetSheets.some(
      (name) => normalizeHeader(name) === normalizeHeader(sheetName),
    ),
  );
  const ranked = candidates
    .map((module) => {
      const parsed = parseModuleSheet(module, rows, sourceName);
      const headerScore = sheetScore(module, rows);
      return {
        module,
        headerScore,
        records: parsed.records.length,
        invalid: parsed.failures.length,
        layout: parsed.layout,
        score: Math.max(
          0,
          headerScore * 2 +
            Math.min(parsed.records.length, 20) * 6 +
            (parsed.matched ? 4 : 0) -
            Math.min(20, parsed.failures.length * 2),
        ),
      };
    })
    .sort((left, right) => right.score - left.score);
  const viable = ranked.filter((candidate) => candidate.records > 0);
  const directCandidate = direct
    ? ranked.find((candidate) => candidate.module.id === direct.id)
    : undefined;
  const directAssessment = direct
    ? SheetAnalyzer.assessKnownSheet(
        sheetName,
        direct.label,
        directCandidate,
      )
    : undefined;

  if (direct && directAssessment && !directAssessment.isValid && viable.length) {
    return {
      direct,
      ranked,
      ambiguous: true,
      reason: directAssessment?.reason || `A aba “${sheetName}” tem nome de “${direct.label}”, mas o conteúdo corresponde a outro módulo. Selecione o destino manualmente.`,
    };
  }
  if (directCandidate?.records && directAssessment?.isValid) {
    const competitor = viable.find(
      (candidate) => candidate.module.id !== directCandidate.module.id,
    );
    if (competitor && SheetAnalyzer.isAmbiguous(directCandidate.score, competitor.score)) {
      return {
        direct,
        ranked,
        ambiguous: true,
        reason: `A aba “${sheetName}” pode ser “${direct.label}” ou “${competitor.module.label}”. Selecione o destino manualmente.`,
      };
    }
    return { direct, selected: direct, ranked, ambiguous: false };
  }
  const first = viable[0];
  const second = viable[1];
  if (!first) {
    return { direct, ranked, ambiguous: false, reason: `A aba “${sheetName}” não possui registros reconhecíveis.` };
  }
  if (second && SheetAnalyzer.isAmbiguous(first.score, second.score)) {
    return {
      direct,
      ranked,
      ambiguous: true,
      reason: `A aba “${sheetName}” pode ser “${first.module.label}” ou “${second.module.label}”. Selecione o destino manualmente.`,
    };
  }
  return { direct, selected: first.module, ranked, ambiguous: false };
}

export async function importWorkbook(file: File, targetModuleId?: string) {
  if (!/\.(?:xlsx|csv)$/i.test(file.name)) {
    throw new Error(
      "Selecione uma planilha .xlsx ou .csv. Arquivos .xls antigos devem ser salvos novamente como .xlsx.",
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

  const sheets: Array<{ sheet: string; data: unknown[][] }> = /\.csv$/i.test(file.name)
    ? [
        {
          sheet: file.name.replace(/\.csv$/i, "").slice(0, 31) || "CSV",
          data: parseCsvRows(await file.text()),
        },
      ]
    : (await readXlsxFile(file)) as Array<{
        sheet: string;
        data: unknown[][];
      }>;
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
  const ambiguousSheets: string[] = [];
  const failures: ImportFailure[] = [];

  for (const sheet of sheets) {
    const sheetRows = sheet.data as unknown[][];
    const resolution = resolveImportSheet(
      candidates,
      sheetRows,
      sheet.sheet,
      `${file.name} / ${sheet.sheet}`,
    );
    if (resolution.ambiguous) {
      ambiguousSheets.push(sheet.sheet);
      failures.push({
        module: "",
        sheet: sheet.sheet,
        location: "identificação da aba",
        reason: resolution.reason || "A estrutura da aba é ambígua.",
        payload: {},
      });
      continue;
    }
    const selected = resolution.selected;
    if (!selected) {
      unmatchedSheets.push(sheet.sheet);
      continue;
    }

    const parsed = parseModuleSheet(
      selected,
      sheetRows,
      `${file.name} / ${sheet.sheet}`,
    );
    let invalid = parsed.failures.length;
    let duplicates = 0;
    let imported = 0;
    const invalidExamples: string[] = parsed.failures
      .slice(0, 8)
      .map((failure) => `${failure.location}: ${failure.reason}`);
    failures.push(
      ...parsed.failures.map((failure) => ({
        module: selected.id,
        sheet: sheet.sheet,
        ...failure,
      })),
    );

    for (const record of parsed.records) {
      const importLocation = record.importLocation || "registro sem posição";
      let issues = validateRecordPayload(record.module, record.payload);
      if (record.module === "works" && record.reference) {
        issues = issues.filter(
          (issue) => !["name", "status"].includes(issue.field),
        );
      }
      if (record.module === "works" && !String(record.payload.manager || "").trim()) {
        issues.push({
          field: "manager",
          message: "O gestor responsável é obrigatório na importação de obras.",
        });
      }
      if (issues.length) {
        invalid += 1;
        const reason = issues
          .map((issue) => `${issue.field}: ${issue.message}`)
          .join("; ");
        if (invalidExamples.length < 8) {
          invalidExamples.push(`${importLocation}: ${reason}`);
        }
        failures.push({
          module: selected.id,
          sheet: sheet.sheet,
          location: importLocation,
          reason,
          payload: record.payload,
        });
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

    const selectedCandidate = resolution.ranked.find(
      (candidate) => candidate.module.id === selected.id,
    );
    const bestScore = selectedCandidate?.headerScore || 0;
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
      detected: resolution.direct?.id !== selected.id,
      invalidExamples,
    });
  }

  return {
    records: accepted,
    report,
    unmatchedSheets,
    ambiguousSheets,
    failures: failures.slice(0, 2_000),
  };
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


/*
 * Campos sem os quais a folha e a rescisão não calculam.
 *
 * O modelo os marca em destaque porque a diferença entre "cadastro
 * preenchido" e "cadastro que calcula" não é óbvia para quem preenche a
 * planilha: falta o salário e o contracheque sai zerado; falta a data de
 * admissão e a rescisão não tem de onde contar o aviso prévio.
 */
const CAMPOS_QUE_O_CALCULO_EXIGE: Record<string, string[]> = {
  people: [
    "cpf",
    "name",
    "salary",
    "monthlyHours",
    "admissionDate",
    "status",
    "role",
    "dependents",
  ],
};

/** Um exemplo por tipo, para o preenchimento não começar do zero. */
function exemploDeCampo(field: ModuleField): string {
  if (field.options?.length) return field.options[Math.min(1, field.options.length - 1)];
  if (field.placeholder) return field.placeholder.replace(/^Ex\.:\s*/i, "");
  switch (field.type) {
    case "date":
      return "2026-01-15";
    case "number":
      return "0";
    case "url":
      return "https://exemplo.com/documento";
    default:
      return "";
  }
}

/**
 * Planilha-modelo para preencher e importar.
 *
 * Existe porque o botão de exportar só serve quando JÁ existem registros —
 * e quem mais precisa do modelo é justamente quem ainda não tem nenhum. Sem
 * ele, preencher exige adivinhar os nomes das colunas, e uma coluna com
 * nome errado é simplesmente ignorada na importação, em silêncio.
 *
 * O cabeçalho usa exatamente os rótulos que o importador reconhece, e a
 * segunda aba explica cada coluna, incluindo quais são obrigatórias para o
 * cálculo funcionar.
 */
export async function exportImportTemplate(module: ModuleDefinition) {
  /*
   * O campo de referência entra na planilha, mesmo sendo "código interno".
   *
   * A regra de ocultar códigos internos vale para a TELA. Aqui ele é a
   * CHAVE: a importação atualiza um registro existente quando reconhece a
   * referência, e cria um novo quando não reconhece. Sem essa coluna,
   * exportar, mudar o salário e reimportar duplicaria o quadro inteiro —
   * silenciosamente, porque cada linha seria vista como gente nova.
   */
  /*
   * O CPF abre a planilha, e não o código do sistema.
   *
   * A importação identifica a pessoa pelo código OU pelo CPF. O código é
   * gerado aqui dentro, então quem monta a planilha no RH não o tem — para
   * usá-lo teria que exportar antes só para descobrir o código de cada um,
   * o que inviabiliza uma folha de milhares de linhas. O CPF já está na
   * mão de quem preenche.
   *
   * O código vem em seguida, preenchido na exportação, para quem prefere
   * trabalhar a partir do que o sistema já tem.
   */
  /*
   * O NOME abre a planilha, porque é o que as planilhas de RH trazem na
   * primeira coluna. Pedir outra ordem obrigaria a remontar o arquivo que
   * eles já usam.
   *
   * CPF e código vêm em seguida, e não por preciosismo: nome não
   * identifica pessoa. Quando a planilha traz um dos dois, a atualização
   * acerta mesmo havendo homônimo — e homônimo numa folha de milhares de
   * linhas é questão de tempo.
   */
  const chaveNome = module.fields.find((field) => field.key === module.titleField);
  const chaveCpf = module.fields.find((field) => field.key === "cpf");
  const referencia = module.fields.find(
    (field) => field.key === module.referenceField,
  );
  const demais = module.fields.filter(
    (field) =>
      !isInternalCodeField(module, field.key) &&
      field.key !== module.referenceField &&
      field.key !== "cpf" &&
      field.key !== module.titleField,
  );
  const campos = [
    ...(chaveNome ? [chaveNome] : []),
    ...(chaveCpf ? [chaveCpf] : []),
    ...(referencia ? [referencia] : []),
    ...demais,
  ];
  const exigidos = new Set(CAMPOS_QUE_O_CALCULO_EXIGE[module.id] ?? []);

  const cabecalho = campos.map((field) => ({
    value: field.label,
    fontWeight: "bold" as const,
    textColor: "#ffffff",
    /* Verde nas colunas que o cálculo exige; azul nas demais. */
    backgroundColor: exigidos.has(field.key) ? "#0f766e" : "#17324d",
    wrap: true,
  }));

  const exemplo = campos.map((field) => ({
    value: exemploDeCampo(field),
    type: String,
    textColor: "#8a97a3",
    fontStyle: "italic" as const,
  }));

  const instrucoes = [
    [
      { value: "Coluna", fontWeight: "bold" as const, textColor: "#ffffff", backgroundColor: "#17324d" },
      { value: "Precisa para calcular?", fontWeight: "bold" as const, textColor: "#ffffff", backgroundColor: "#17324d" },
      { value: "O que preencher", fontWeight: "bold" as const, textColor: "#ffffff", backgroundColor: "#17324d" },
    ],
    ...campos.map((field) => [
      { value: field.label, type: String },
      {
        value: exigidos.has(field.key)
          ? "SIM"
          : field.required
            ? "Obrigatório no cadastro"
            : "Opcional",
        type: String,
        fontWeight: exigidos.has(field.key) ? ("bold" as const) : undefined,
      },
      {
        value:
          field.key === module.titleField
            ? "IDENTIFICA A PESSOA. Se o nome já existir no sistema, a linha " +
              "ATUALIZA aquele cadastro em vez de criar outro. Maiúsculas, " +
              "acentos e espaços a mais não atrapalham. ATENÇÃO: se houver DUAS " +
              "pessoas com o mesmo nome, nenhuma é atualizada — a linha vira " +
              "cadastro novo, de propósito, para não alterar a pessoa errada. " +
              "Nesse caso preencha o CPF ou o código ao lado."
            : field.key === "cpf"
            ? "IDENTIFICA A PESSOA, com mais segurança que o nome. Preencha " +
              "quando houver homônimos. Pode vir com ou sem pontos."
            : field.key === module.referenceField
            ? "CHAVE DE ATUALIZAÇÃO. Deixe em branco para criar um cadastro novo. " +
              "Preencha com o código de um cadastro existente para ATUALIZAR esse " +
              "cadastro em vez de criar outro — é assim que se corrige um salário " +
              "pela planilha sem duplicar a pessoa."
            : (field.help ??
              (field.options?.length
                ? `Use um destes: ${field.options.join(", ")}`
                : field.placeholder ?? "")),
        type: String,
      },
    ]),
  ] as SheetData;

  await writeXlsxFile(
    [
      {
        sheet: module.shortLabel.slice(0, 31),
        data: [cabecalho, exemplo] as SheetData,
        columns: campos.map((field) => ({
          width: field.wide ? 32 : Math.max(16, Math.min(28, field.label.length + 4)),
        })),
        stickyRowsCount: 1,
      },
      {
        sheet: "Como preencher",
        data: instrucoes,
        columns: [{ width: 34 }, { width: 24 }, { width: 80 }],
        stickyRowsCount: 1,
      },
    ],
  ).toFile(
    `Modelo_Importacao_${module.shortLabel.replace(/\s+/g, "_")}.xlsx`,
  );
}

export async function exportModuleWorkbook(
  module: ModuleDefinition,
  records: Array<{ payload: Record<string, unknown> }>,
) {
  /*
   * A exportação leva a chave junto pelo mesmo motivo do modelo: este
   * arquivo costuma voltar. Alguém exporta, ajusta salários na planilha e
   * reimporta — e sem a referência cada linha voltaria como pessoa nova.
   */
  const exportName = module.fields.find(
    (field) => field.key === module.titleField,
  );
  const exportCpf = module.fields.find((field) => field.key === "cpf");
  const exportReference = module.fields.find(
    (field) => field.key === module.referenceField,
  );
  const exportOthers = module.fields.filter(
    (field) =>
      !isInternalCodeField(module, field.key) &&
      field.key !== module.referenceField &&
      field.key !== "cpf" &&
      field.key !== module.titleField,
  );
  const exportFields = [
    ...(exportName ? [exportName] : []),
    ...(exportCpf ? [exportCpf] : []),
    ...(exportReference ? [exportReference] : []),
    ...exportOthers,
  ];
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
    .filter((module) => module.id !== "m365")
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
