import { readFileSync, writeFileSync, rmSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const write = (path, content) => writeFileSync(path, content, "utf8");

function requireText(content, needle, label) {
  if (!content.includes(needle)) {
    throw new Error(`V60: marcador não encontrado em ${label}: ${needle.slice(0, 100)}`);
  }
}

function replaceOnce(content, before, after, label) {
  requireText(content, before, label);
  const next = content.replace(before, after);
  if (next === content) throw new Error(`V60: substituição não aplicada em ${label}`);
  return next;
}

function moduleBlock(content, id, nextId, transform) {
  const startMarker = `  {\n    id: "${id}",`;
  const endMarker = `  {\n    id: "${nextId}",`;
  const start = content.indexOf(startMarker);
  const end = content.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) throw new Error(`V60: bloco ${id} não encontrado`);
  const original = content.slice(start, end);
  const updated = transform(original);
  if (updated === original) throw new Error(`V60: bloco ${id} não foi alterado`);
  return content.slice(0, start) + updated + content.slice(end);
}

function insertAfterStatus(block, fields) {
  const expression = /(\{ key: "status", label: "[^"]+", type: "select"[^\n]+\},\n)/;
  if (!expression.test(block)) throw new Error("V60: campo status não encontrado no bloco");
  return block.replace(expression, `$1${fields}`);
}

// ---------------------------------------------------------------------------
// Módulos e campos de pagamento / RH
// ---------------------------------------------------------------------------
let modules = read("app/lib/modules.ts");

modules = moduleBlock(modules, "contractors", "worklogs", (block) => {
  block = replaceOnce(
    block,
    '      { key: "invoiceUrl", label: "Nota fiscal / fatura", type: "url" },\n',
    '      { key: "invoiceUrl", label: "Nota fiscal / fatura", type: "url" },\n' +
      '      { key: "paymentDate", label: "Data do pagamento", type: "date" },\n' +
      '      { key: "paidAmount", label: "Valor efetivamente pago", type: "currency" },\n' +
      '      { key: "receiptUrl", label: "Comprovante de pagamento", type: "url", placeholder: "Cole o link do comprovante salvo no SharePoint ou OneDrive" },\n',
    "contractors",
  );
  return block;
});

modules = moduleBlock(modules, "cards", "rentals", (block) => {
  block = insertAfterStatus(
    block,
    '      { key: "paymentDate", label: "Data do pagamento da fatura", type: "date" },\n' +
      '      { key: "paidAmount", label: "Valor efetivamente pago", type: "currency" },\n' +
      '      { key: "receiptUrl", label: "Comprovante de pagamento da fatura", type: "url", placeholder: "Cole o link do comprovante" },\n',
  );
  return block;
});

modules = moduleBlock(modules, "assets", "asset_events", (block) => {
  block = replaceOnce(
    block,
    '      { key: "paymentDate", label: "Data do pagamento", type: "date", aliases: ["Data pagamento"] },\n',
    '      { key: "paymentDate", label: "Data do pagamento", type: "date", aliases: ["Data pagamento"] },\n' +
      '      { key: "receiptUrl", label: "Comprovante do pagamento da locação", type: "url", placeholder: "Cole o link do comprovante", aliases: ["Link comprovante"] },\n',
    "assets",
  );
  return block;
});

modules = moduleBlock(modules, "asset_events", "people", (block) => {
  block = replaceOnce(
    block,
    '      { key: "paymentDate", label: "Data do pagamento", type: "date" },\n',
    '      { key: "paymentDate", label: "Data do pagamento", type: "date" },\n' +
      '      { key: "receiptUrl", label: "Comprovante do pagamento da manutenção", type: "url", placeholder: "Cole o link do comprovante" },\n',
    "asset_events",
  );
  return block;
});

modules = moduleBlock(modules, "people", "payroll", (block) => {
  block = replaceOnce(
    block,
    '      { key: "status", label: "Status", type: "select", required: true, options: ["Ativo", "Afastado", "Férias", "Em desligamento", "Desligado"], aliases: ["Status"] },\n',
    '      { key: "status", label: "Status", type: "select", required: true, options: ["Ativo", "Afastado", "Férias", "Em desligamento", "Desligado"], aliases: ["Status"] },\n' +
      '      { key: "vacationAcquisitionStart", label: "Início do período aquisitivo vigente", type: "date", help: "Não use uma data fixa para todos. Informe conforme a admissão e os períodos já concedidos." },\n' +
      '      { key: "vacationAcquisitionEnd", label: "Fim do período aquisitivo vigente", type: "date" },\n' +
      '      { key: "vacationStart", label: "Início das férias atuais ou programadas", type: "date" },\n' +
      '      { key: "vacationEnd", label: "Fim das férias atuais ou programadas", type: "date" },\n' +
      '      { key: "vacationDays", label: "Dias de férias", type: "number" },\n',
    "people",
  );
  return block;
});

modules = moduleBlock(modules, "purchases", "documents", (block) => {
  block = replaceOnce(
    block,
    '    tableColumns: ["requestId", "requestDate", "work", "material", "quantity", "totalAmount", "status", "documentsUrl"],\n',
    '    tableColumns: ["requestId", "requestDate", "work", "material", "quantity", "totalAmount", "status", "paymentStatus", "receiptUrl"],\n',
    "purchases columns",
  );
  block = insertAfterStatus(
    block,
    '      { key: "paymentStatus", label: "Situação do pagamento", type: "select", options: ["Pendente", "Pago"] },\n' +
      '      { key: "paymentDate", label: "Data do pagamento", type: "date" },\n' +
      '      { key: "paidAmount", label: "Valor efetivamente pago", type: "currency" },\n' +
      '      { key: "receiptUrl", label: "Comprovante de pagamento", type: "url", placeholder: "Cole o link do comprovante salvo no SharePoint ou OneDrive" },\n',
  );
  return block;
});

modules = replaceOnce(
  modules,
  '  purchases:\n    "Descreva claramente o material, a quantidade, a obra e a data necessária antes de iniciar as cotações.",\n',
  '  purchases:\n    "Descreva claramente o material, a quantidade, a obra e a data necessária antes de iniciar as cotações. O pedido só pode ficar Pago depois de informar data, valor efetivamente pago e comprovante.",\n',
  "moduleTips purchases",
);
modules = replaceOnce(
  modules,
  '  people:\n    "Este módulo acompanha quadro e custos de pessoal. Documentos pessoais devem ficar apenas em pastas restritas.",\n',
  '  people:\n    "Use as abas Ativos, Férias e Inativos para organizar o quadro. O status alimenta a seleção da folha e dos cálculos; férias devem usar o período aquisitivo individual, nunca uma data fixa para todos.",\n',
  "moduleTips people",
);
write("app/lib/modules.ts", modules);

// ---------------------------------------------------------------------------
// Validação central de pagamentos comprovados
// ---------------------------------------------------------------------------
let validation = read("app/lib/record-validation.ts");
const numberMarker = `function numberValue(payload: Record<string, unknown>, key: string) {\n  const value = Number(payload[key]);\n  return Number.isFinite(value) ? value : 0;\n}\n\n`;
const paymentRules = `type PaymentEvidenceRule = {\n  statusKey: string;\n  dateKey: string;\n  amountKey: string;\n  proofKey: string;\n  expectedKeys: string[];\n};\n\nconst paymentEvidenceRules: Record<string, PaymentEvidenceRule> = {\n  expenses: { statusKey: "status", dateKey: "paymentDate", amountKey: "paidAmount", proofKey: "receiptUrl", expectedKeys: ["expectedAmount"] },\n  taxes: { statusKey: "status", dateKey: "paymentDate", amountKey: "paidAmount", proofKey: "receiptUrl", expectedKeys: ["expectedAmount"] },\n  purchases: { statusKey: "paymentStatus", dateKey: "paymentDate", amountKey: "paidAmount", proofKey: "receiptUrl", expectedKeys: ["totalAmount"] },\n  cards: { statusKey: "status", dateKey: "paymentDate", amountKey: "paidAmount", proofKey: "receiptUrl", expectedKeys: ["amount"] },\n  contractors: { statusKey: "status", dateKey: "paymentDate", amountKey: "paidAmount", proofKey: "receiptUrl", expectedKeys: ["netAmount", "measuredAmount"] },\n  assets: { statusKey: "paymentStatus", dateKey: "paymentDate", amountKey: "paidAmount", proofKey: "receiptUrl", expectedKeys: ["monthlyCost"] },\n  asset_events: { statusKey: "paymentStatus", dateKey: "paymentDate", amountKey: "paidAmount", proofKey: "receiptUrl", expectedKeys: ["maintenanceCost"] },\n};\n\nfunction normalizedStatus(value: unknown) {\n  return String(value ?? "")\n    .normalize("NFD")\n    .replace(/[\\u0300-\\u036f]/g, "")\n    .trim()\n    .toLowerCase();\n}\n\nfunction validatePaymentEvidence(\n  definition: ModuleDefinition,\n  payload: Record<string, unknown>,\n): RecordValidationIssue[] {\n  const rule = paymentEvidenceRules[definition.id];\n  if (!rule) return [];\n  const status = normalizedStatus(payload[rule.statusKey]);\n  if (!["pago", "paga"].includes(status)) return [];\n\n  const issues: RecordValidationIssue[] = [];\n  const paidAmount = numberValue(payload, rule.amountKey);\n  const expectedAmount = rule.expectedKeys\n    .map((key) => numberValue(payload, key))\n    .find((value) => value > 0) || 0;\n\n  if (isBlank(payload[rule.dateKey])) {\n    issues.push({\n      field: rule.dateKey,\n      message: "Informe a data do pagamento antes de marcar o item como Pago.",\n    });\n  }\n  if (paidAmount <= 0) {\n    issues.push({\n      field: rule.amountKey,\n      message: "Informe o valor efetivamente pago antes de marcar o item como Pago.",\n    });\n  }\n  if (isBlank(payload[rule.proofKey])) {\n    issues.push({\n      field: rule.proofKey,\n      message: "Anexe ou informe o link do comprovante antes de marcar o item como Pago.",\n    });\n  }\n  if (expectedAmount > 0 && paidAmount > expectedAmount + 0.01) {\n    issues.push({\n      field: rule.amountKey,\n      message: "O valor pago não pode superar o valor previsto sem uma correção do lançamento.",\n    });\n  }\n  return issues;\n}\n\n`;
validation = replaceOnce(validation, numberMarker, numberMarker + paymentRules, "record validation helper");

const oldExpenseRule = `  if (\n    ["expenses", "taxes"].includes(definition.id) &&\n    String(payload.status ?? "").toLowerCase() === "pago" &&\n    isBlank(payload.paymentDate)\n  ) {\n    issues.push({\n      field: "paymentDate",\n      message: "Informe a data de pagamento para um item com status Pago.",\n    });\n  }\n\n`;
validation = replaceOnce(validation, oldExpenseRule, "", "remove duplicate payment date rule");

const businessStart = validation.indexOf("function validateBusinessRules(");
const exportStart = validation.indexOf("export function validateRecordPayload", businessStart);
if (businessStart < 0 || exportStart < 0) throw new Error("V60: bloco validateBusinessRules não encontrado");
let businessBlock = validation.slice(businessStart, exportStart);
const returnIndex = businessBlock.lastIndexOf("  return issues;\n}");
if (returnIndex < 0) throw new Error("V60: retorno validateBusinessRules não encontrado");
businessBlock =
  businessBlock.slice(0, returnIndex) +
  "  issues.push(...validatePaymentEvidence(definition, payload));\n\n" +
  businessBlock.slice(returnIndex);
validation = validation.slice(0, businessStart) + businessBlock + validation.slice(exportStart);
write("app/lib/record-validation.ts", validation);

// ---------------------------------------------------------------------------
// Importador XLSX: detecção, validação, duplicidades e relatório
// ---------------------------------------------------------------------------
let spreadsheet = read("app/lib/spreadsheet.ts");
spreadsheet = replaceOnce(
  spreadsheet,
  '} from "./modules";\n',
  '} from "./modules";\nimport { validateRecordPayload } from "./record-validation";\n',
  "spreadsheet import validation",
);
const importStart = spreadsheet.indexOf("export async function importWorkbook(");
const excelCellStart = spreadsheet.indexOf("function excelCell(", importStart);
if (importStart < 0 || excelCellStart < 0) throw new Error("V60: importWorkbook não encontrado");
const importReplacement = `function sheetScore(module: ModuleDefinition, rows: unknown[][]) {\n  const aliases = headerAliases(module);\n  let best = 0;\n  for (const row of rows.slice(0, 25)) {\n    const normalized = row.map(normalizeHeader);\n    const score = aliases.filter(({ normalized: fieldAliases }) =>\n      normalized.some((header) => fieldAliases.includes(header)),\n    ).length;\n    best = Math.max(best, score);\n  }\n  return best;\n}\n\nfunction importKey(record: ImportRecord) {\n  const reference = record.reference.trim().toLowerCase();\n  if (reference) return \\`${record.module}::ref::${reference}\\`;\n  return \\`${record.module}::${record.title.trim().toLowerCase()}::${record.recordDate}::${record.amount}\\`;\n}\n\nexport async function importWorkbook(file: File, targetModuleId?: string) {\n  if (!/\\.xlsx?$/i.test(file.name)) {\n    throw new Error("Selecione um arquivo Excel no formato .xlsx ou .xls.");\n  }\n  if (file.size > 15 * 1024 * 1024) {\n    throw new Error("A planilha ultrapassa 15 MB. Divida o arquivo em partes menores.");\n  }\n\n  const sheets = await readXlsxFile(file);\n  const candidates = targetModuleId\n    ? moduleDefinitions.filter((module) => module.id === targetModuleId)\n    : moduleDefinitions.filter((module) => module.spreadsheetSheets.length);\n  if (!candidates.length) throw new Error("O módulo escolhido não aceita importação por planilha.");\n\n  const accepted: ImportRecord[] = [];\n  const seen = new Set<string>();\n  const report: Array<{\n    module: string;\n    sheet: string;\n    imported: number;\n    skipped: number;\n    invalid: number;\n    duplicates: number;\n    confidence: number;\n    detected: boolean;\n  }> = [];\n  const unmatchedSheets: string[] = [];\n\n  for (const sheet of sheets) {\n    const direct = candidates.find((module) =>\n      module.spreadsheetSheets.some(\n        (name) => normalizeHeader(name) === normalizeHeader(sheet.sheet),\n      ),\n    );\n    const scored = candidates\n      .map((module) => ({ module, score: sheetScore(module, sheet.data as unknown[][]) }))\n      .sort((a, b) => b.score - a.score);\n    const selected = direct || (scored[0]?.score >= 2 ? scored[0].module : undefined);\n    if (!selected) {\n      unmatchedSheets.push(sheet.sheet);\n      continue;\n    }\n\n    const parsed = parseModuleSheet(\n      selected,\n      sheet.data as unknown[][],\n      \\`${file.name} / ${sheet.sheet}\\`,\n    );\n    let invalid = 0;\n    let duplicates = 0;\n    let imported = 0;\n    for (const record of parsed.records) {\n      const issues = validateRecordPayload(record.module, record.payload);\n      if (issues.length) {\n        invalid += 1;\n        continue;\n      }\n      const key = importKey(record);\n      if (seen.has(key)) {\n        duplicates += 1;\n        continue;\n      }\n      seen.add(key);\n      accepted.push(record);\n      imported += 1;\n      if (accepted.length > 10_000) {\n        throw new Error("A importação ultrapassa 10.000 registros. Divida a planilha em arquivos menores.");\n      }\n    }\n\n    const bestScore = direct ? Math.max(2, sheetScore(selected, sheet.data as unknown[][])) : scored[0]?.score || 0;\n    const confidence = Math.min(100, Math.round((bestScore / Math.max(2, selected.fields.length)) * 300));\n    report.push({\n      module: selected.label,\n      sheet: sheet.sheet,\n      imported,\n      skipped: parsed.skipped,\n      invalid,\n      duplicates,\n      confidence,\n      detected: !direct,\n    });\n  }\n\n  return { records: accepted, report, unmatchedSheets };\n}\n\n`;
spreadsheet = spreadsheet.slice(0, importStart) + importReplacement + spreadsheet.slice(excelCellStart);
write("app/lib/spreadsheet.ts", spreadsheet);

// ---------------------------------------------------------------------------
// Interface: abas de RH, explicação de regras, importação em lotes e obra
// ---------------------------------------------------------------------------
let app = read("app/components/BetaApp.tsx");

const statusSnippet = `  const statuses = Array.from(\n    new Set(records.map(recordStatusLabel).filter(Boolean)),\n  );\n`;
const peopleCounts = `  const peopleStatusCounts = {\n    active: records.filter((record) => recordStatusLabel(record) === "Ativo").length,\n    vacation: records.filter((record) => recordStatusLabel(record) === "Férias").length,\n    inactive: records.filter((record) =>\n      ["Em desligamento", "Desligado"].includes(recordStatusLabel(record)),\n    ).length,\n  };\n`;
app = replaceOnce(app, statusSnippet, statusSnippet + peopleCounts, "ModulePage people counts");

const visibleFilter = `    return (\n      (!search || haystack.includes(search.toLowerCase())) &&\n      (!status || recordStatusLabel(record) === status)\n    );\n`;
const visibleReplacement = `    const displayedStatus = recordStatusLabel(record);\n    const matchesStatus =\n      !status ||\n      (module.id === "people" && status === "__inactive__"\n        ? ["Em desligamento", "Desligado"].includes(displayedStatus)\n        : displayedStatus === status);\n    return (!search || haystack.includes(search.toLowerCase())) && matchesStatus;\n`;
app = replaceOnce(app, visibleFilter, visibleReplacement, "ModulePage people filter");

const topNavigationMarker = `      {topNavigation}\n\n`;
const tabsAndRules = `      {topNavigation}\n\n      {module.id === "people" ? (\n        <nav className="people-status-tabs" aria-label="Situação dos colaboradores">\n          {[\n            ["Ativos", "Ativo", peopleStatusCounts.active],\n            ["Férias", "Férias", peopleStatusCounts.vacation],\n            ["Inativos", "__inactive__", peopleStatusCounts.inactive],\n          ].map(([label, value, count]) => (\n            <button\n              key={String(value)}\n              type="button"\n              className={status === value ? "active" : ""}\n              onClick={() => setStatus(status === value ? "" : String(value))}\n            >\n              <span>{label}</span>\n              <strong>{String(count)}</strong>\n            </button>\n          ))}\n          <p>O status é reutilizado na seleção da folha e dos cálculos. Férias não usam uma data padrão: cada colaborador mantém seu próprio período aquisitivo.</p>\n        </nav>\n      ) : null}\n\n      {module.id === "rules" ? (\n        <aside className="rule-engine-explainer">\n          <div>\n            <strong>O que o Motor de Regras faz hoje</strong>\n            <p>Versiona fontes, vigências e parâmetros homologados usados pelos cálculos e validações do sistema.</p>\n          </div>\n          <div>\n            <strong>O que ele não faz sozinho</strong>\n            <p>Uma regra cadastrada não executa código automaticamente. Ela precisa estar ligada a uma validação ou cálculo testado.</p>\n          </div>\n          <div>\n            <strong>Como melhorar com segurança</strong>\n            <p>Definir condição, ação, prioridade, vigência, responsável, cenário de teste e aprovação antes de ativar.</p>\n          </div>\n        </aside>\n      ) : null}\n\n`;
app = replaceOnce(app, topNavigationMarker, tabsAndRules, "ModulePage tabs and rules explainer");

const filterSelect = `          <select\n            className="filter-select"\n            value={status}\n            onChange={(event) => setStatus(event.target.value)}\n          >\n            <option value="">Todos os status</option>\n            {statuses.map((item) => (\n              <option key={item}>{item}</option>\n            ))}\n          </select>\n`;
const filterReplacement = `          {module.id !== "people" ? (\n            <select\n              className="filter-select"\n              value={status}\n              onChange={(event) => setStatus(event.target.value)}\n            >\n              <option value="">Todos os status</option>\n              {statuses.map((item) => (\n                <option key={item}>{item}</option>\n              ))}\n            </select>\n          ) : null}\n`;
app = replaceOnce(app, filterSelect, filterReplacement, "ModulePage status select");

const importFunctionStart = app.indexOf("  async function handleImport(file?: File) {");
const nextAsync = app.indexOf("\n  async function", importFunctionStart + 20);
if (importFunctionStart < 0 || nextAsync < 0) throw new Error("V60: handleImport não encontrado");
const newImportFunction = `  async function handleImport(file?: File) {\n    if (!file || !hasEditingAccess()) return;\n    try {\n      setToast({ kind: "success", text: "Lendo, identificando e validando a planilha…" });\n      const imported = await importWorkbook(file, importTarget);\n      if (!imported.records.length) {\n        const unmatched = imported.unmatchedSheets.length\n          ? \\` Abas não reconhecidas: ${imported.unmatchedSheets.join(", ")}.\\`\n          : "";\n        throw new Error(\n          \\`Nenhum registro válido foi encontrado.${unmatched} Revise os cabeçalhos e os campos obrigatórios.\\`,\n        );\n      }\n\n      const preview = imported.report\n        .map((item) =>\n          \\`${item.sheet} → ${item.module}: ${item.imported} válidos, ${item.invalid} inválidos, ${item.duplicates} duplicados, ${item.skipped} ignorados\\`,\n        )\n        .join("\\n");\n      const confirmed = window.confirm(\n        \\`Prévia da importação\\n\\n${preview}\\n\\nTotal pronto para importar: ${imported.records.length}.\\n\\nConfirma a gravação?\\`,\n      );\n      if (!confirmed) {\n        setToast({ kind: "success", text: "Importação revisada e cancelada sem gravar dados." });\n        return;\n      }\n\n      let importedCount = 0;\n      const batchSize = 250;\n      for (let index = 0; index < imported.records.length; index += batchSize) {\n        const batch = imported.records.slice(index, index + batchSize);\n        const response = await fetch("/api/records", {\n          method: "POST",\n          headers: { "content-type": "application/json" },\n          body: JSON.stringify({ records: batch }),\n        });\n        const result = (await response.json()) as {\n          result?: { count: number };\n          error?: string;\n        };\n        if (!response.ok) throw new Error(result.error || "Falha ao gravar um lote da planilha.");\n        importedCount += result.result?.count || batch.length;\n      }\n\n      await loadRecords();\n      setToast({\n        kind: "success",\n        text: \\`${importedCount} registros importados após detecção, validação e conferência.\\`,\n      });\n    } catch (error) {\n      setToast({\n        kind: "error",\n        text: error instanceof Error ? error.message : "Não foi possível importar a planilha.",\n      });\n    }\n  }\n`;
app = app.slice(0, importFunctionStart) + newImportFunction + app.slice(nextAsync);

const workforceStart = app.indexOf('        <article className="construction-workforce-card">');
const lossStart = app.indexOf('        <article className="construction-loss-card">', workforceStart);
if (workforceStart < 0 || lossStart < 0) throw new Error("V60: painel Operação Própria não encontrado");
app = app.slice(0, workforceStart) + app.slice(lossStart);
write("app/components/BetaApp.tsx", app);

// ---------------------------------------------------------------------------
// CSS e importação global
// ---------------------------------------------------------------------------
const v60Css = `/* V60 — Pagamentos comprovados, RH segmentado e obra alinhada. */\n\n.people-status-tabs {\n  display: grid;\n  grid-template-columns: repeat(3, minmax(0, 1fr));\n  gap: 12px;\n  padding: 14px;\n  border: 1px solid #d7e3ea;\n  border-radius: 20px;\n  background: #ffffff;\n  box-shadow: 0 10px 30px rgba(7, 35, 55, 0.06);\n}\n\n.people-status-tabs button {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  min-height: 58px;\n  padding: 12px 16px;\n  border: 1px solid #d7e3ea;\n  border-radius: 14px;\n  color: #17324d;\n  background: #f8fbfc;\n  font-size: 14px;\n  font-weight: 800;\n}\n\n.people-status-tabs button strong {\n  display: grid;\n  min-width: 30px;\n  height: 30px;\n  place-items: center;\n  border-radius: 999px;\n  color: #0d4267;\n  background: #dff4f8;\n}\n\n.people-status-tabs button.active {\n  border-color: #10607f;\n  color: #ffffff;\n  background: linear-gradient(135deg, #082f50, #10607f);\n  box-shadow: 0 10px 24px rgba(8, 47, 80, 0.18);\n}\n\n.people-status-tabs button.active strong {\n  color: #ffffff;\n  background: rgba(255, 255, 255, 0.16);\n}\n\n.people-status-tabs > p {\n  grid-column: 1 / -1;\n  margin: 0;\n  color: #587185;\n  font-size: 12px;\n  line-height: 1.55;\n}\n\n.rule-engine-explainer {\n  display: grid;\n  grid-template-columns: repeat(3, minmax(0, 1fr));\n  gap: 14px;\n}\n\n.rule-engine-explainer > div {\n  padding: 18px;\n  border: 1px solid #cfe0e8;\n  border-radius: 18px;\n  background: linear-gradient(145deg, #ffffff, #f2f8fa);\n  box-shadow: 0 10px 26px rgba(7, 35, 55, 0.055);\n}\n\n.rule-engine-explainer strong {\n  display: block;\n  color: #123a55;\n  font-size: 15px;\n}\n\n.rule-engine-explainer p {\n  margin: 7px 0 0;\n  color: #5b7385;\n  font-size: 13px;\n  line-height: 1.55;\n}\n\n/* Operação Própria foi removida por duplicar o KPI de equipe. */\n.construction-operational-detail-grid {\n  grid-template-columns: minmax(0, 1fr) !important;\n}\n\n.construction-loss-card {\n  width: 100%;\n}\n\n/* Execução da obra mais compacta, alinhada e legível. */\n.construction-executive-v2 .construction-dashboard-heading-v56 h3,\n.construction-executive-v2 .construction-stage-roadmap h3,\n.construction-executive-v2 .construction-priority-board h3,\n.construction-executive-v2 .construction-health-board h3,\n.construction-executive-v2 .construction-loss-card h3,\n.construction-executive-v2 .construction-fleet-v2 h3 {\n  font-size: clamp(21px, 1.45vw, 26px) !important;\n  line-height: 1.22;\n}\n\n.construction-executive-v2 .construction-kpi-row-v56 {\n  align-items: stretch;\n}\n\n.construction-executive-v2 .construction-kpi-v56 {\n  display: flex;\n  min-height: 158px;\n  flex-direction: column;\n  justify-content: flex-start;\n}\n\n.construction-executive-v2 .construction-kpi-v56 > strong {\n  font-size: clamp(25px, 1.8vw, 34px);\n  letter-spacing: -0.045em;\n}\n\n.construction-executive-v2 .construction-stage-track {\n  align-items: stretch;\n  overflow-x: auto;\n  scroll-snap-type: x proximity;\n}\n\n.construction-executive-v2 .construction-stage-track article {\n  display: grid;\n  min-width: 138px;\n  align-content: start;\n  gap: 7px;\n  scroll-snap-align: start;\n  text-align: left;\n}\n\n.construction-executive-v2 .construction-stage-track article > strong {\n  min-height: 36px;\n  font-size: 12px;\n}\n\n.construction-executive-v2 .construction-main-grid-v56 {\n  align-items: start;\n}\n\n.construction-executive-v2 .construction-stage-card-v56 > p {\n  font-size: 15px;\n  line-height: 1.55;\n}\n\n.construction-executive-v2 .construction-budget-lines-v56 > div {\n  min-height: 45px;\n}\n\n.construction-executive-v2 .construction-budget-lines-v56 strong {\n  font-size: 14px;\n}\n\n@media (max-width: 780px) {\n  .people-status-tabs,\n  .rule-engine-explainer {\n    grid-template-columns: 1fr;\n  }\n\n  .construction-executive-v2 .construction-kpi-row-v56 {\n    grid-template-columns: 1fr;\n  }\n}\n`;
write("app/v60.css", v60Css);

let layout = read("app/layout.tsx");
layout = replaceOnce(
  layout,
  'import "./construction-executive-v59.css";\n',
  'import "./construction-executive-v59.css";\nimport "./v60.css";\n',
  "layout v60 import",
);
write("app/layout.tsx", layout);

// ---------------------------------------------------------------------------
// Regressões
// ---------------------------------------------------------------------------
const tests = `import assert from "node:assert/strict";\nimport { readFile } from "node:fs/promises";\nimport test from "node:test";\n\nconst modules = await readFile("app/lib/modules.ts", "utf8");\nconst validation = await readFile("app/lib/record-validation.ts", "utf8");\nconst spreadsheet = await readFile("app/lib/spreadsheet.ts", "utf8");\nconst app = await readFile("app/components/BetaApp.tsx", "utf8");\nconst layout = await readFile("app/layout.tsx", "utf8");\nconst css = await readFile("app/v60.css", "utf8");\n\ntest("V60 exige comprovante, data e valor para pagamentos confirmados", () => {\n  assert.match(validation, /paymentEvidenceRules/);\n  assert.match(validation, /Anexe ou informe o link do comprovante/);\n  assert.match(validation, /Informe o valor efetivamente pago/);\n  assert.match(validation, /purchases: \{ statusKey: "paymentStatus"/);\n  assert.match(modules, /Comprovante de pagamento da fatura/);\n  assert.match(modules, /Comprovante do pagamento da locação/);\n  assert.match(modules, /Comprovante do pagamento da manutenção/);\n});\n\ntest("V60 organiza colaboradores sem cálculo de férias fixo", () => {\n  assert.match(app, /people-status-tabs/);\n  assert.match(app, /Ativos/);\n  assert.match(app, /Férias/);\n  assert.match(app, /Inativos/);\n  assert.match(modules, /vacationAcquisitionStart/);\n  assert.doesNotMatch(modules, /2020-01-06T00:00:00Z/);\n});\n\ntest("V60 mantém o motor de regras honesto e auditável", () => {\n  assert.match(app, /O que o Motor de Regras faz hoje/);\n  assert.match(app, /Uma regra cadastrada não executa código automaticamente/);\n  assert.doesNotMatch(app, /MotorDeRegrasExecucao/);\n});\n\ntest("V60 importa Excel com detecção, prévia, validação e lotes", () => {\n  assert.match(spreadsheet, /sheetScore/);\n  assert.match(spreadsheet, /validateRecordPayload/);\n  assert.match(spreadsheet, /duplicates/);\n  assert.match(app, /Prévia da importação/);\n  assert.match(app, /batchSize = 250/);\n  assert.doesNotMatch(spreadsheet, /csv-parser|bullmq|createReadStream/);\n});\n\ntest("V60 remove Operação Própria e alinha o painel da obra", () => {\n  assert.doesNotMatch(app, /construction-workforce-card/);\n  assert.match(css, /construction-operational-detail-grid/);\n  assert.match(css, /scroll-snap-type: x proximity/);\n  assert.match(layout, /v60\\.css/);\n});\n`;
write("tests/v60-improvements.test.mjs", tests);

// Remove os artefatos temporários da transformação do commit final.
rmSync("scripts/apply-v60.mjs", { force: true });
rmSync(".github/workflows/apply-v60.yml", { force: true });

console.log("V60 aplicada e arquivos temporários removidos.");
