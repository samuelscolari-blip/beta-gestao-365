import {
  IBS_CBS_DEFAULTS,
  IBS_CBS_RULES_VERSION,
  calculateAssessment,
  validateFiscalDocument,
} from "../app/lib/ibs-cbs.js";

export const DEFAULT_TENANT_ID = "beta-construtora";

type D1Row = Record<string, unknown>;

async function database() {
  const { env } = await import("cloudflare:workers");
  if (!env.DB) throw new Error("O banco de dados do sistema não está disponível.");
  return env.DB;
}

const text = (value: unknown, max = 500) => String(value ?? "").trim().slice(0, max);
const number = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const flag = (value: unknown) =>
  value === true ||
  value === 1 ||
  value === "1" ||
  String(value).trim().toLowerCase() === "true";
const bool = (value: unknown) => (flag(value) ? 1 : 0);

export async function ensureIbsCbsSchema() {
  const db = await database();
  await db.batch([
    db.prepare(`
      CREATE TABLE IF NOT EXISTS ibs_cbs_configurations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id TEXT NOT NULL,
        regime TEXT NOT NULL DEFAULT 'Regime regular',
        incidence_enabled INTEGER NOT NULL DEFAULT 1,
        effective_from TEXT NOT NULL,
        effective_to TEXT NOT NULL DEFAULT '',
        ibs_state_rate REAL NOT NULL DEFAULT 0.1,
        ibs_municipal_rate REAL NOT NULL DEFAULT 0,
        cbs_rate REAL NOT NULL DEFAULT 0.9,
        reduction_percent REAL NOT NULL DEFAULT 0,
        deferment_percent REAL NOT NULL DEFAULT 0,
        credit_enabled INTEGER NOT NULL DEFAULT 1,
        special_regime TEXT NOT NULL DEFAULT '',
        notes TEXT NOT NULL DEFAULT '',
        rules_version TEXT NOT NULL DEFAULT 'BR-RTC-2026.2-NT2025.002-v1.40',
        created_by TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_by TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS fiscal_documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id TEXT NOT NULL,
        direction TEXT NOT NULL,
        fiscal_key TEXT NOT NULL DEFAULT '',
        document_number TEXT NOT NULL DEFAULT '',
        series TEXT NOT NULL DEFAULT '',
        issue_date TEXT NOT NULL DEFAULT '',
        due_date TEXT NOT NULL DEFAULT '',
        competence TEXT NOT NULL DEFAULT '',
        partner_name TEXT NOT NULL DEFAULT '',
        partner_tax_id TEXT NOT NULL DEFAULT '',
        supplier_tax_regime TEXT NOT NULL DEFAULT '',
        item_description TEXT NOT NULL DEFAULT '',
        item_code TEXT NOT NULL DEFAULT '',
        cst TEXT NOT NULL DEFAULT '',
        cclass_trib TEXT NOT NULL DEFAULT '',
        operation_value REAL NOT NULL DEFAULT 0,
        reduction_percent REAL NOT NULL DEFAULT 0,
        taxable_base REAL NOT NULL DEFAULT 0,
        ibs_state_rate REAL NOT NULL DEFAULT 0,
        ibs_municipal_rate REAL NOT NULL DEFAULT 0,
        ibs_amount REAL NOT NULL DEFAULT 0,
        cbs_rate REAL NOT NULL DEFAULT 0,
        cbs_amount REAL NOT NULL DEFAULT 0,
        deferment_percent REAL NOT NULL DEFAULT 0,
        credit_eligible INTEGER NOT NULL DEFAULT 0,
        credit_amount REAL NOT NULL DEFAULT 0,
        presumed_credit REAL NOT NULL DEFAULT 0,
        blocked_credit REAL NOT NULL DEFAULT 0,
        blocked_credit_reason TEXT NOT NULL DEFAULT '',
        credit_basis TEXT NOT NULL DEFAULT '',
        work_name TEXT NOT NULL DEFAULT '',
        cost_center TEXT NOT NULL DEFAULT '',
        document_url TEXT NOT NULL DEFAULT '',
        compliance_status TEXT NOT NULL DEFAULT '',
        critical_count INTEGER NOT NULL DEFAULT 0,
        warning_count INTEGER NOT NULL DEFAULT 0,
        validation_json TEXT NOT NULL DEFAULT '[]',
        calculation_json TEXT NOT NULL DEFAULT '{}',
        source_module TEXT NOT NULL DEFAULT '',
        is_active INTEGER NOT NULL DEFAULT 1,
        superseded_by INTEGER,
        created_by TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_by TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS fiscal_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id TEXT NOT NULL,
        document_id INTEGER NOT NULL,
        line_number INTEGER NOT NULL DEFAULT 1,
        item_description TEXT NOT NULL DEFAULT '',
        item_code TEXT NOT NULL DEFAULT '',
        cst TEXT NOT NULL DEFAULT '',
        cclass_trib TEXT NOT NULL DEFAULT '',
        quantity REAL NOT NULL DEFAULT 1,
        unit_value REAL NOT NULL DEFAULT 0,
        operation_value REAL NOT NULL DEFAULT 0,
        reduction_percent REAL NOT NULL DEFAULT 0,
        taxable_base REAL NOT NULL DEFAULT 0,
        ibs_state_rate REAL NOT NULL DEFAULT 0,
        ibs_municipal_rate REAL NOT NULL DEFAULT 0,
        ibs_amount REAL NOT NULL DEFAULT 0,
        cbs_rate REAL NOT NULL DEFAULT 0,
        cbs_amount REAL NOT NULL DEFAULT 0,
        deferment_percent REAL NOT NULL DEFAULT 0,
        credit_eligible INTEGER NOT NULL DEFAULT 0,
        credit_amount REAL NOT NULL DEFAULT 0,
        presumed_credit REAL NOT NULL DEFAULT 0,
        blocked_credit REAL NOT NULL DEFAULT 0,
        blocked_credit_reason TEXT NOT NULL DEFAULT '',
        credit_basis TEXT NOT NULL DEFAULT '',
        validation_json TEXT NOT NULL DEFAULT '[]',
        calculation_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(document_id) REFERENCES fiscal_documents(id) ON DELETE CASCADE
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS ibs_cbs_assessments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id TEXT NOT NULL,
        competence TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'Aberta',
        ibs_debits REAL NOT NULL DEFAULT 0,
        ibs_credits REAL NOT NULL DEFAULT 0,
        ibs_balance REAL NOT NULL DEFAULT 0,
        cbs_debits REAL NOT NULL DEFAULT 0,
        cbs_credits REAL NOT NULL DEFAULT 0,
        cbs_balance REAL NOT NULL DEFAULT 0,
        blocked_credits REAL NOT NULL DEFAULT 0,
        debit_adjustments REAL NOT NULL DEFAULT 0,
        credit_adjustments REAL NOT NULL DEFAULT 0,
        pis_cofins_compensation REAL NOT NULL DEFAULT 0,
        technical_balance REAL NOT NULL DEFAULT 0,
        pending_documents INTEGER NOT NULL DEFAULT 0,
        critical_issues INTEGER NOT NULL DEFAULT 0,
        close_reason TEXT NOT NULL DEFAULT '',
        closed_by TEXT NOT NULL DEFAULT '',
        closed_at TEXT NOT NULL DEFAULT '',
        reopened_by TEXT NOT NULL DEFAULT '',
        reopened_at TEXT NOT NULL DEFAULT '',
        reopen_reason TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tenant_id, competence)
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS ibs_cbs_adjustments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id TEXT NOT NULL,
        competence TEXT NOT NULL,
        adjustment_type TEXT NOT NULL,
        tax_type TEXT NOT NULL DEFAULT 'IBS/CBS',
        amount REAL NOT NULL DEFAULT 0,
        reason TEXT NOT NULL DEFAULT '',
        actor TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS compliance_issues (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id TEXT NOT NULL,
        document_id INTEGER NOT NULL,
        item_line INTEGER NOT NULL DEFAULT 0,
        code TEXT NOT NULL,
        severity TEXT NOT NULL,
        message TEXT NOT NULL,
        field_name TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'Aberta',
        resolved_by TEXT NOT NULL DEFAULT '',
        resolved_at TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS ibs_cbs_audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id TEXT NOT NULL,
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id INTEGER,
        summary TEXT NOT NULL DEFAULT '',
        payload_json TEXT NOT NULL DEFAULT '{}',
        actor TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),
    db.prepare("CREATE INDEX IF NOT EXISTS ibs_cbs_config_tenant_idx ON ibs_cbs_configurations (tenant_id, effective_from)"),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS ibs_cbs_assessment_tenant_competence_unique ON ibs_cbs_assessments (tenant_id, competence)"),
    db.prepare("CREATE INDEX IF NOT EXISTS fiscal_documents_tenant_key_idx ON fiscal_documents (tenant_id, fiscal_key) WHERE fiscal_key <> ''"),
    db.prepare("CREATE INDEX IF NOT EXISTS fiscal_documents_competence_idx ON fiscal_documents (tenant_id, competence)"),
    db.prepare("CREATE INDEX IF NOT EXISTS fiscal_items_document_idx ON fiscal_items (tenant_id, document_id, line_number)"),
    db.prepare("CREATE INDEX IF NOT EXISTS fiscal_documents_status_idx ON fiscal_documents (tenant_id, compliance_status)"),
    db.prepare("CREATE INDEX IF NOT EXISTS ibs_cbs_adjustments_comp_idx ON ibs_cbs_adjustments (tenant_id, competence)"),
    db.prepare("CREATE INDEX IF NOT EXISTS compliance_issues_document_idx ON compliance_issues (tenant_id, document_id, status)"),
    db.prepare("CREATE INDEX IF NOT EXISTS ibs_cbs_audit_tenant_idx ON ibs_cbs_audit_logs (tenant_id, created_at)"),
  ]);

  const existing = await db
    .prepare("SELECT id FROM ibs_cbs_configurations WHERE tenant_id = ? ORDER BY effective_from DESC, id DESC LIMIT 1")
    .bind(DEFAULT_TENANT_ID)
    .first<{ id: number }>();
  if (!existing) {
    await db.prepare(`
      INSERT INTO ibs_cbs_configurations (
        tenant_id, regime, incidence_enabled, effective_from, effective_to,
        ibs_state_rate, ibs_municipal_rate, cbs_rate, reduction_percent,
        deferment_percent, credit_enabled, notes, rules_version, created_by, updated_by
      ) VALUES (?, ?, 1, ?, ?, ?, ?, ?, 0, 0, 1, ?, ?, ?, ?)
    `).bind(
      DEFAULT_TENANT_ID,
      "Regime regular",
      IBS_CBS_DEFAULTS.effectiveFrom,
      IBS_CBS_DEFAULTS.effectiveTo,
      IBS_CBS_DEFAULTS.ibsStateRate,
      IBS_CBS_DEFAULTS.ibsMunicipalRate,
      IBS_CBS_DEFAULTS.cbsRate,
      "Configuração inicial de 2026: IBS UF 0,1%, IBS municipal 0% e CBS 0,9%, conforme a NT 2025.002 v1.40. Alíquotas parametrizáveis.",
      IBS_CBS_RULES_VERSION,
      "Sistema",
      "Sistema",
    ).run();
  }
}

async function audit(action: string, entityType: string, entityId: number | null, summary: string, payload: unknown, actor: string, tenantId = DEFAULT_TENANT_ID) {
  const db = await database();
  await db.prepare(`
    INSERT INTO ibs_cbs_audit_logs
      (tenant_id, action, entity_type, entity_id, summary, payload_json, actor)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    tenantId,
    text(action, 80),
    text(entityType, 80),
    entityId,
    text(summary, 500),
    JSON.stringify(payload ?? {}),
    text(actor, 240),
  ).run();
}

function configFromRow(row?: D1Row | null) {
  return {
    id: Number(row?.id || 0),
    tenantId: String(row?.tenant_id || DEFAULT_TENANT_ID),
    regime: String(row?.regime || "Regime regular"),
    incidenceEnabled: Boolean(row?.incidence_enabled ?? 1),
    effectiveFrom: String(row?.effective_from || IBS_CBS_DEFAULTS.effectiveFrom),
    effectiveTo: String(row?.effective_to || IBS_CBS_DEFAULTS.effectiveTo),
    ibsStateRate: Number(row?.ibs_state_rate ?? IBS_CBS_DEFAULTS.ibsStateRate),
    ibsMunicipalRate: Number(row?.ibs_municipal_rate ?? IBS_CBS_DEFAULTS.ibsMunicipalRate),
    ibsRate: Number(row?.ibs_state_rate ?? IBS_CBS_DEFAULTS.ibsStateRate) + Number(row?.ibs_municipal_rate ?? IBS_CBS_DEFAULTS.ibsMunicipalRate),
    cbsRate: Number(row?.cbs_rate ?? IBS_CBS_DEFAULTS.cbsRate),
    reductionPercent: Number(row?.reduction_percent || 0),
    defermentPercent: Number(row?.deferment_percent || 0),
    creditEnabled: Boolean(row?.credit_enabled ?? 1),
    specialRegime: String(row?.special_regime || ""),
    notes: String(row?.notes || ""),
    rulesVersion: String(row?.rules_version || IBS_CBS_RULES_VERSION),
    createdBy: String(row?.created_by || ""),
    createdAt: String(row?.created_at || ""),
    updatedBy: String(row?.updated_by || ""),
    updatedAt: String(row?.updated_at || ""),
  };
}

export async function getIbsCbsConfig(tenantId = DEFAULT_TENANT_ID, referenceDate?: string | null) {
  await ensureIbsCbsSchema();
  const db = await database();
  const rawReference = text(referenceDate || new Date().toISOString().slice(0, 10), 20);
  const targetDate = /^\d{4}-\d{2}$/.test(rawReference) ? `${rawReference}-01` : rawReference.slice(0, 10);
  let row = await db.prepare(`
    SELECT * FROM ibs_cbs_configurations
    WHERE tenant_id = ?
      AND effective_from <= ?
      AND (effective_to = '' OR effective_to >= ?)
    ORDER BY effective_from DESC, id DESC LIMIT 1
  `).bind(tenantId, targetDate, targetDate).first<D1Row>();
  if (!row) {
    row = await db.prepare(`
      SELECT * FROM ibs_cbs_configurations
      WHERE tenant_id = ?
      ORDER BY effective_from DESC, id DESC LIMIT 1
    `).bind(tenantId).first<D1Row>();
  }
  return configFromRow(row);
}

export async function listIbsCbsConfigHistory(tenantId = DEFAULT_TENANT_ID) {
  await ensureIbsCbsSchema();
  const db = await database();
  const rows = await db.prepare(`
    SELECT * FROM ibs_cbs_configurations
    WHERE tenant_id = ?
    ORDER BY effective_from DESC, id DESC LIMIT 100
  `).bind(tenantId).all<D1Row>();
  return (rows.results || []).map(configFromRow);
}

export async function saveIbsCbsConfig(input: Record<string, unknown>, actor: string, tenantId = DEFAULT_TENANT_ID) {
  await ensureIbsCbsSchema();
  const db = await database();
  const current = await getIbsCbsConfig(tenantId);
  const normalized = {
    regime: text(input.regime || current.regime, 80),
    incidenceEnabled:
      input.incidenceEnabled === undefined
        ? current.incidenceEnabled
        : flag(input.incidenceEnabled),
    effectiveFrom: text(input.effectiveFrom || current.effectiveFrom, 20),
    effectiveTo: text(input.effectiveTo ?? current.effectiveTo, 20),
    ibsStateRate: Math.max(0, number(input.ibsStateRate ?? current.ibsStateRate)),
    ibsMunicipalRate: Math.max(0, number(input.ibsMunicipalRate ?? current.ibsMunicipalRate)),
    cbsRate: Math.max(0, number(input.cbsRate ?? current.cbsRate)),
    reductionPercent: Math.min(100, Math.max(0, number(input.reductionPercent ?? current.reductionPercent))),
    defermentPercent: Math.min(100, Math.max(0, number(input.defermentPercent ?? current.defermentPercent))),
    creditEnabled:
      input.creditEnabled === undefined
        ? current.creditEnabled
        : flag(input.creditEnabled),
    specialRegime: text(input.specialRegime ?? current.specialRegime, 240),
    notes: text(input.notes ?? current.notes, 2000),
  };
  if (!normalized.effectiveFrom) throw new Error("A data inicial de vigência é obrigatória.");

  // Histórico imutável: uma nova linha é criada para cada alteração de vigência/configuração.
  const row = await db.prepare(`
    INSERT INTO ibs_cbs_configurations (
      tenant_id, regime, incidence_enabled, effective_from, effective_to,
      ibs_state_rate, ibs_municipal_rate, cbs_rate, reduction_percent,
      deferment_percent, credit_enabled, special_regime, notes, rules_version,
      created_by, updated_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING *
  `).bind(
    tenantId,
    normalized.regime,
    bool(normalized.incidenceEnabled),
    normalized.effectiveFrom,
    normalized.effectiveTo,
    normalized.ibsStateRate,
    normalized.ibsMunicipalRate,
    normalized.cbsRate,
    normalized.reductionPercent,
    normalized.defermentPercent,
    bool(normalized.creditEnabled),
    normalized.specialRegime,
    normalized.notes,
    IBS_CBS_RULES_VERSION,
    actor,
    actor,
  ).first<D1Row>();
  const saved = configFromRow(row);
  await audit("CONFIG_CREATE", "configuration", saved.id, `Nova vigência ${saved.effectiveFrom} criada`, saved, actor, tenantId);
  return saved;
}

function itemFromRow(row: D1Row) {
  let validation: unknown[] = [];
  let calculation: Record<string, unknown> = {};
  try { validation = JSON.parse(String(row.validation_json || "[]")); } catch {}
  try { calculation = JSON.parse(String(row.calculation_json || "{}")); } catch {}
  return {
    id: Number(row.id),
    documentId: Number(row.document_id),
    lineNumber: Number(row.line_number || 1),
    itemDescription: String(row.item_description || ""),
    itemCode: String(row.item_code || ""),
    cst: String(row.cst || ""),
    cClassTrib: String(row.cclass_trib || ""),
    quantity: Number(row.quantity || 0),
    unitValue: Number(row.unit_value || 0),
    operationValue: Number(row.operation_value || 0),
    reductionPercent: Number(row.reduction_percent || 0),
    taxableBase: Number(row.taxable_base || 0),
    ibsStateRate: Number(row.ibs_state_rate || 0),
    ibsMunicipalRate: Number(row.ibs_municipal_rate || 0),
    ibsAmount: Number(row.ibs_amount || 0),
    cbsRate: Number(row.cbs_rate || 0),
    cbsAmount: Number(row.cbs_amount || 0),
    defermentPercent: Number(row.deferment_percent || 0),
    creditEligible: Boolean(row.credit_eligible),
    creditAmount: Number(row.credit_amount || 0),
    presumedCredit: Number(row.presumed_credit || 0),
    blockedCredit: Number(row.blocked_credit || 0),
    blockedCreditReason: String(row.blocked_credit_reason || ""),
    creditBasis: String(row.credit_basis || ""),
    validation,
    calculation,
  };
}

function documentFromRow(row: D1Row, items: Array<Record<string, unknown>> = []) {
  let validation: unknown[] = [];
  let calculation: Record<string, unknown> = {};
  try { validation = JSON.parse(String(row.validation_json || "[]")); } catch {}
  try { calculation = JSON.parse(String(row.calculation_json || "{}")); } catch {}
  return {
    id: Number(row.id),
    tenantId: String(row.tenant_id),
    direction: String(row.direction),
    fiscalKey: String(row.fiscal_key || ""),
    documentNumber: String(row.document_number || ""),
    series: String(row.series || ""),
    issueDate: String(row.issue_date || ""),
    dueDate: String(row.due_date || ""),
    competence: String(row.competence || ""),
    partnerName: String(row.partner_name || ""),
    partnerTaxId: String(row.partner_tax_id || ""),
    supplierTaxRegime: String(row.supplier_tax_regime || ""),
    itemDescription: String(row.item_description || ""),
    itemCode: String(row.item_code || ""),
    cst: String(row.cst || ""),
    cClassTrib: String(row.cclass_trib || ""),
    operationValue: Number(row.operation_value || 0),
    reductionPercent: Number(row.reduction_percent || 0),
    taxableBase: Number(row.taxable_base || 0),
    ibsStateRate: Number(row.ibs_state_rate || 0),
    ibsMunicipalRate: Number(row.ibs_municipal_rate || 0),
    ibsAmount: Number(row.ibs_amount || 0),
    cbsRate: Number(row.cbs_rate || 0),
    cbsAmount: Number(row.cbs_amount || 0),
    defermentPercent: Number(row.deferment_percent || 0),
    creditEligible: Boolean(row.credit_eligible),
    creditAmount: Number(row.credit_amount || 0),
    presumedCredit: Number(row.presumed_credit || 0),
    blockedCredit: Number(row.blocked_credit || 0),
    blockedCreditReason: String(row.blocked_credit_reason || ""),
    creditBasis: String(row.credit_basis || ""),
    work: String(row.work_name || ""),
    costCenter: String(row.cost_center || ""),
    documentUrl: String(row.document_url || ""),
    complianceStatus: String(row.compliance_status || ""),
    criticalCount: Number(row.critical_count || 0),
    warningCount: Number(row.warning_count || 0),
    validation,
    calculation,
    items,
    sourceModule: String(row.source_module || ""),
    isActive: Boolean(row.is_active ?? 1),
    supersededBy: row.superseded_by ? Number(row.superseded_by) : null,
    createdBy: String(row.created_by || ""),
    createdAt: String(row.created_at || ""),
    updatedBy: String(row.updated_by || ""),
    updatedAt: String(row.updated_at || ""),
  };
}

export async function listFiscalDocuments(tenantId = DEFAULT_TENANT_ID, competence?: string | null) {
  await ensureIbsCbsSchema();
  const db = await database();
  const query = competence
    ? db.prepare("SELECT * FROM fiscal_documents WHERE tenant_id = ? AND competence = ? AND is_active = 1 ORDER BY issue_date DESC, id DESC LIMIT 1000").bind(tenantId, competence)
    : db.prepare("SELECT * FROM fiscal_documents WHERE tenant_id = ? AND is_active = 1 ORDER BY issue_date DESC, id DESC LIMIT 1000").bind(tenantId);
  const rows = await query.all<D1Row>();
  const documents = rows.results || [];
  if (!documents.length) return [];
  const itemQuery = competence
    ? db
        .prepare(`
          SELECT item.*
          FROM fiscal_items AS item
          INNER JOIN fiscal_documents AS document
            ON document.id = item.document_id
           AND document.tenant_id = item.tenant_id
          WHERE item.tenant_id = ?
            AND document.competence = ?
            AND document.is_active = 1
          ORDER BY item.document_id, item.line_number
        `)
        .bind(tenantId, competence)
    : db
        .prepare(`
          SELECT item.*
          FROM fiscal_items AS item
          INNER JOIN fiscal_documents AS document
            ON document.id = item.document_id
           AND document.tenant_id = item.tenant_id
          WHERE item.tenant_id = ?
            AND document.is_active = 1
          ORDER BY item.document_id, item.line_number
        `)
        .bind(tenantId);
  const itemRows = await itemQuery.all<D1Row>();
  const grouped = new Map<number, Array<Record<string, unknown>>>();
  for (const row of itemRows.results || []) {
    const documentId = Number(row.document_id);
    const list = grouped.get(documentId) || [];
    list.push(itemFromRow(row));
    grouped.set(documentId, list);
  }
  return documents.map((row) => documentFromRow(row, grouped.get(Number(row.id)) || []));
}

export async function saveFiscalDocument(input: Record<string, unknown>, actor: string, tenantId = DEFAULT_TENANT_ID) {
  await ensureIbsCbsSchema();
  const db = await database();
  const competence = text(input.competence || input.issueDate, 20).slice(0, 7);
  const config = await getIbsCbsConfig(tenantId, text(input.issueDate || `${competence}-01`, 20));
  const replaceDocumentId = Number(input.replaceDocumentId || 0);
  const closedAssessment = competence
    ? await db.prepare("SELECT status FROM ibs_cbs_assessments WHERE tenant_id = ? AND competence = ?").bind(tenantId, competence).first<{ status: string }>()
    : null;
  if (closedAssessment?.status === "Fechada") {
    throw new Error("A competência está fechada. Reabra a apuração antes de lançar ou corrigir documentos.");
  }
  const normalizedKey = text(input.fiscalKey, 60).replace(/\D/g, "");
  const duplicate = normalizedKey
    ? await db.prepare("SELECT id FROM fiscal_documents WHERE tenant_id = ? AND fiscal_key = ? AND is_active = 1 AND id <> ?").bind(tenantId, normalizedKey, replaceDocumentId || -1).first<{ id: number }>()
    : null;

  const rawItems = Array.isArray(input.items) && input.items.length
    ? (input.items as Array<Record<string, unknown>>).slice(0, 100)
    : [input];
  const itemResults = rawItems.map((item, index) => {
    const quantity = Math.max(0, number(item.quantity || 1));
    const unitValue = Math.max(0, number(item.unitValue));
    const operationValue = number(item.operationValue) || (quantity * unitValue);
    const validation = validateFiscalDocument(
      {
        ...input,
        ...item,
        fiscalKey: normalizedKey,
        operationValue,
        competence: input.competence || input.issueDate,
      },
      config,
      [],
    );
    return { index, quantity, unitValue, operationValue, item, validation };
  });

  const headerIssues = itemResults.flatMap((result) =>
    result.validation.issues.map((issue) => ({ ...issue, lineNumber: result.index + 1 })),
  );
  if (duplicate) {
    headerIssues.push({
      code: "DUPLICATE_DOCUMENT",
      severity: "critical",
      message: "Documento fiscal duplicado para a mesma empresa.",
      field: "fiscalKey",
      lineNumber: 0,
    });
  }
  const dueDate = text(input.dueDate, 20).slice(0, 10);
  if (input.direction === "outgoing" && !dueDate) {
    headerIssues.push({
      code: "DUE_DATE_REQUIRED",
      severity: "warning",
      message: "Informe o vencimento fiscal para exibição no painel gerencial.",
      field: "dueDate",
      lineNumber: 0,
    });
  } else if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    headerIssues.push({
      code: "INVALID_DUE_DATE",
      severity: "critical",
      message: "O vencimento fiscal deve usar uma data válida.",
      field: "dueDate",
      lineNumber: 0,
    });
  } else if (dueDate && text(input.issueDate, 20) && dueDate < text(input.issueDate, 20).slice(0, 10)) {
    headerIssues.push({
      code: "DUE_DATE_BEFORE_ISSUE",
      severity: "warning",
      message: "O vencimento informado é anterior à emissão da nota.",
      field: "dueDate",
      lineNumber: 0,
    });
  }
  const criticalCount = headerIssues.filter((issue) => issue.severity === "critical").length;
  const warningCount = headerIssues.filter((issue) => issue.severity === "warning").length;
  const allNotApplicable = itemResults.every((result) => result.validation.applicable === false);
  const complianceStatus = criticalCount
    ? "Bloqueado para fechamento"
    : warningCount
      ? "Pendente de conferência"
      : allNotApplicable
        ? "Não aplicável"
        : "Conforme";

  const totals = itemResults.reduce(
    (acc, result) => {
      const calculation = result.validation.calculation;
      acc.operationValue += number(calculation.operationValue);
      acc.taxableBase += number(calculation.taxableBase);
      acc.ibsAmount += number(calculation.ibsAmount);
      acc.cbsAmount += number(calculation.cbsAmount);
      acc.creditAmount += number(calculation.creditAmount);
      acc.presumedCredit += number(calculation.presumedCredit);
      acc.blockedCredit += number(calculation.blockedCredit);
      return acc;
    },
    { operationValue: 0, taxableBase: 0, ibsAmount: 0, cbsAmount: 0, creditAmount: 0, presumedCredit: 0, blockedCredit: 0 },
  );
  const first = itemResults[0];
  const firstCalc = first.validation.calculation;
  const firstItem = first.item;

  const row = await db.prepare(`
    INSERT INTO fiscal_documents (
      tenant_id, direction, fiscal_key, document_number, series, issue_date,
      due_date, competence, partner_name, partner_tax_id, supplier_tax_regime,
      item_description, item_code, cst, cclass_trib, operation_value,
      reduction_percent, taxable_base, ibs_state_rate, ibs_municipal_rate,
      ibs_amount, cbs_rate, cbs_amount, deferment_percent, credit_eligible,
      credit_amount, presumed_credit, blocked_credit, blocked_credit_reason,
      credit_basis, work_name, cost_center, document_url, compliance_status,
      critical_count, warning_count, validation_json, calculation_json,
      source_module, created_by, updated_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING *
  `).bind(
    tenantId,
    input.direction === "outgoing" ? "outgoing" : "incoming",
    normalizedKey,
    text(input.documentNumber, 80),
    text(input.series, 40),
    text(input.issueDate, 20),
    dueDate,
    competence,
    text(input.partnerName, 240),
    text(input.partnerTaxId, 40),
    text(input.supplierTaxRegime, 100),
    text(firstItem.itemDescription, 500),
    text(firstItem.itemCode, 80),
    text(firstItem.cst, 40),
    text(firstItem.cClassTrib, 80),
    totals.operationValue,
    number(firstCalc.reductionPercent),
    totals.taxableBase,
    number(firstCalc.ibsStateRate),
    number(firstCalc.ibsMunicipalRate),
    totals.ibsAmount,
    number(firstCalc.cbsRate),
    totals.cbsAmount,
    number(firstCalc.defermentPercent),
    bool(itemResults.some((result) => Boolean(result.validation.calculation.creditEligible))),
    totals.creditAmount,
    totals.presumedCredit,
    totals.blockedCredit,
    text(firstCalc.blockedCreditReason || input.blockedCreditReason, 1000),
    text(input.creditBasis || firstItem.creditBasis, 1000),
    text(input.work, 240),
    text(input.costCenter, 240),
    text(input.documentUrl, 1000),
    complianceStatus,
    criticalCount,
    warningCount,
    JSON.stringify(headerIssues),
    JSON.stringify({ totals, itemCount: itemResults.length, rulesVersion: IBS_CBS_RULES_VERSION }),
    text(input.sourceModule, 80),
    actor,
    actor,
  ).first<D1Row>();
  if (!row) throw new Error("Não foi possível registrar o documento fiscal.");

  const statements = itemResults.map((result) => {
    const calculation = result.validation.calculation;
    const item = result.item;
    return db.prepare(`
      INSERT INTO fiscal_items (
        tenant_id, document_id, line_number, item_description, item_code, cst,
        cclass_trib, quantity, unit_value, operation_value, reduction_percent,
        taxable_base, ibs_state_rate, ibs_municipal_rate, ibs_amount, cbs_rate,
        cbs_amount, deferment_percent, credit_eligible, credit_amount,
        presumed_credit, blocked_credit, blocked_credit_reason, credit_basis,
        validation_json, calculation_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      tenantId,
      Number(row.id),
      result.index + 1,
      text(item.itemDescription, 500),
      text(item.itemCode, 80),
      text(item.cst, 40),
      text(item.cClassTrib, 80),
      result.quantity,
      result.unitValue,
      number(calculation.operationValue),
      number(calculation.reductionPercent),
      number(calculation.taxableBase),
      number(calculation.ibsStateRate),
      number(calculation.ibsMunicipalRate),
      number(calculation.ibsAmount),
      number(calculation.cbsRate),
      number(calculation.cbsAmount),
      number(calculation.defermentPercent),
      bool(calculation.creditEligible),
      number(calculation.creditAmount),
      number(calculation.presumedCredit),
      number(calculation.blockedCredit),
      text(calculation.blockedCreditReason || item.blockedCreditReason || input.blockedCreditReason, 1000),
      text(item.creditBasis || input.creditBasis, 1000),
      JSON.stringify(result.validation.issues),
      JSON.stringify(calculation),
    );
  });
  if (statements.length) await db.batch(statements);
  const issueStatements = headerIssues.map((issue) =>
    db.prepare(`
      INSERT INTO compliance_issues
        (tenant_id, document_id, item_line, code, severity, message, field_name)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      tenantId,
      Number(row.id),
      Number(issue.lineNumber || 0),
      text(issue.code, 80),
      text(issue.severity, 20),
      text(issue.message, 500),
      text(issue.field, 80),
    ),
  );
  if (issueStatements.length) await db.batch(issueStatements);

  const savedItems = statements.length
    ? await db.prepare("SELECT * FROM fiscal_items WHERE tenant_id = ? AND document_id = ? ORDER BY line_number").bind(tenantId, Number(row.id)).all<D1Row>()
    : { results: [] };
  const saved = documentFromRow(row, (savedItems.results || []).map(itemFromRow));
  if (replaceDocumentId) {
    await db.prepare(`
      UPDATE fiscal_documents SET
        is_active = 0, superseded_by = ?, compliance_status = 'Substituído',
        updated_by = ?, updated_at = CURRENT_TIMESTAMP
      WHERE tenant_id = ? AND id = ?
    `).bind(saved.id, actor, tenantId, replaceDocumentId).run();
    await db.prepare(`
      UPDATE compliance_issues SET
        status = 'Resolvida por substituição', resolved_by = ?, resolved_at = CURRENT_TIMESTAMP
      WHERE tenant_id = ? AND document_id = ? AND status = 'Aberta'
    `).bind(actor, tenantId, replaceDocumentId).run();
    await audit("DOCUMENT_SUPERSEDE", "fiscal_document", replaceDocumentId, `Documento substituído pela versão ${saved.id}`, { supersededBy: saved.id }, actor, tenantId);
  }
  await audit("DOCUMENT_CREATE", "fiscal_document", saved.id, `${saved.documentNumber || saved.fiscalKey}: ${saved.complianceStatus}`, { input, headerIssues, totals }, actor, tenantId);
  return saved;
}

export async function deleteFiscalDocument(id: number, actor: string, tenantId = DEFAULT_TENANT_ID) {
  await ensureIbsCbsSchema();
  const db = await database();
  const existing = await db.prepare("SELECT * FROM fiscal_documents WHERE tenant_id = ? AND id = ? AND is_active = 1").bind(tenantId, id).first<D1Row>();
  if (!existing) throw new Error("Documento fiscal não encontrado ou já inativo.");
  const competence = String(existing.competence || "");
  const assessment = competence
    ? await db.prepare("SELECT status FROM ibs_cbs_assessments WHERE tenant_id = ? AND competence = ?").bind(tenantId, competence).first<{ status: string }>()
    : null;
  if (assessment?.status === "Fechada") throw new Error("Reabra a competência antes de excluir o documento.");
  await db.prepare(`
    UPDATE fiscal_documents SET
      is_active = 0, compliance_status = 'Excluído', updated_by = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE tenant_id = ? AND id = ?
  `).bind(actor, tenantId, id).run();
  await db.prepare(`
    UPDATE compliance_issues SET
      status = 'Encerrada por exclusão lógica', resolved_by = ?, resolved_at = CURRENT_TIMESTAMP
    WHERE tenant_id = ? AND document_id = ? AND status = 'Aberta'
  `).bind(actor, tenantId, id).run();
  await audit("DOCUMENT_SOFT_DELETE", "fiscal_document", id, text(existing.document_number || existing.fiscal_key), { previousStatus: existing.compliance_status }, actor, tenantId);
  return { id, softDeleted: true };
}

function assessmentFromRow(row: D1Row) {
  return {
    id: Number(row.id),
    tenantId: String(row.tenant_id),
    competence: String(row.competence),
    status: String(row.status),
    ibsDebits: Number(row.ibs_debits || 0),
    ibsCredits: Number(row.ibs_credits || 0),
    ibsBalance: Number(row.ibs_balance || 0),
    cbsDebits: Number(row.cbs_debits || 0),
    cbsCredits: Number(row.cbs_credits || 0),
    cbsBalance: Number(row.cbs_balance || 0),
    blockedCredits: Number(row.blocked_credits || 0),
    debitAdjustments: Number(row.debit_adjustments || 0),
    creditAdjustments: Number(row.credit_adjustments || 0),
    pisCofinsCompensation: Number(row.pis_cofins_compensation || 0),
    technicalBalance: Number(row.technical_balance || 0),
    pendingDocuments: Number(row.pending_documents || 0),
    criticalIssues: Number(row.critical_issues || 0),
    closeReason: String(row.close_reason || ""),
    closedBy: String(row.closed_by || ""),
    closedAt: String(row.closed_at || ""),
    reopenedBy: String(row.reopened_by || ""),
    reopenedAt: String(row.reopened_at || ""),
    reopenReason: String(row.reopen_reason || ""),
    createdAt: String(row.created_at || ""),
    updatedAt: String(row.updated_at || ""),
  };
}

export async function getAssessment(competence: string, tenantId = DEFAULT_TENANT_ID) {
  await ensureIbsCbsSchema();
  const db = await database();
  const documents = await listFiscalDocuments(tenantId, competence);
  const live = calculateAssessment(documents, competence);
  const stored = await db.prepare("SELECT * FROM ibs_cbs_assessments WHERE tenant_id = ? AND competence = ?").bind(tenantId, competence).first<D1Row>();
  return { ...live, ...(stored ? assessmentFromRow(stored) : {}), live };
}

export async function closeAssessment(competence: string, actor: string, input: Record<string, unknown> = {}, tenantId = DEFAULT_TENANT_ID) {
  await ensureIbsCbsSchema();
  const db = await database();
  if (!competence) throw new Error("Competência obrigatória.");
  const currentAssessment = await db.prepare("SELECT status FROM ibs_cbs_assessments WHERE tenant_id = ? AND competence = ?").bind(tenantId, competence).first<{ status: string }>();
  if (currentAssessment?.status === "Fechada") throw new Error("A competência já está fechada. Reabra antes de efetuar novo fechamento.");
  const documents = await listFiscalDocuments(tenantId, competence);
  const live = calculateAssessment(documents, competence);
  if (live.criticalIssues > 0) throw new Error("A competência possui erros críticos e não pode ser fechada.");
  const debitAdjustments = Math.max(0, number(input.debitAdjustments));
  const creditAdjustments = Math.max(0, number(input.creditAdjustments));
  const pisCofinsCompensation = competence.startsWith("2026-")
    ? Math.max(0, number(input.pisCofinsCompensation))
    : 0;
  if (
    (debitAdjustments || creditAdjustments || pisCofinsCompensation) &&
    !text(input.reason)
  ) {
    throw new Error(
      "Informe o motivo e o fundamento técnico dos ajustes antes do fechamento.",
    );
  }
  const technicalBalance = number(live.ibsBalance) + number(live.cbsBalance) + debitAdjustments - creditAdjustments - pisCofinsCompensation;
  const row = await db.prepare(`
    INSERT INTO ibs_cbs_assessments (
      tenant_id, competence, status, ibs_debits, ibs_credits, ibs_balance,
      cbs_debits, cbs_credits, cbs_balance, blocked_credits, debit_adjustments,
      credit_adjustments, pis_cofins_compensation, technical_balance,
      pending_documents, critical_issues, close_reason, closed_by, closed_at
    ) VALUES (?, ?, 'Fechada', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(tenant_id, competence) DO UPDATE SET
      status = 'Fechada', ibs_debits = excluded.ibs_debits,
      ibs_credits = excluded.ibs_credits, ibs_balance = excluded.ibs_balance,
      cbs_debits = excluded.cbs_debits, cbs_credits = excluded.cbs_credits,
      cbs_balance = excluded.cbs_balance, blocked_credits = excluded.blocked_credits,
      debit_adjustments = excluded.debit_adjustments,
      credit_adjustments = excluded.credit_adjustments,
      pis_cofins_compensation = excluded.pis_cofins_compensation,
      technical_balance = excluded.technical_balance,
      pending_documents = excluded.pending_documents,
      critical_issues = excluded.critical_issues,
      close_reason = excluded.close_reason, closed_by = excluded.closed_by,
      closed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    RETURNING *
  `).bind(
    tenantId,
    competence,
    live.ibsDebits,
    live.ibsCredits,
    live.ibsBalance,
    live.cbsDebits,
    live.cbsCredits,
    live.cbsBalance,
    live.blockedCredits,
    debitAdjustments,
    creditAdjustments,
    pisCofinsCompensation,
    technicalBalance,
    live.pendingDocuments,
    live.criticalIssues,
    text(input.reason || "Fechamento técnico da competência", 500),
    actor,
  ).first<D1Row>();
  const saved = assessmentFromRow(row || {});
  const adjustmentStatements = [
    debitAdjustments !== 0
      ? db.prepare("INSERT INTO ibs_cbs_adjustments (tenant_id, competence, adjustment_type, tax_type, amount, reason, actor) VALUES (?, ?, 'Débito', 'IBS/CBS', ?, ?, ?)").bind(tenantId, competence, debitAdjustments, text(input.reason, 500), actor)
      : null,
    creditAdjustments !== 0
      ? db.prepare("INSERT INTO ibs_cbs_adjustments (tenant_id, competence, adjustment_type, tax_type, amount, reason, actor) VALUES (?, ?, 'Crédito', 'IBS/CBS', ?, ?, ?)").bind(tenantId, competence, creditAdjustments, text(input.reason, 500), actor)
      : null,
    pisCofinsCompensation !== 0
      ? db.prepare("INSERT INTO ibs_cbs_adjustments (tenant_id, competence, adjustment_type, tax_type, amount, reason, actor) VALUES (?, ?, 'Compensação', 'PIS/COFINS', ?, ?, ?)").bind(tenantId, competence, pisCofinsCompensation, text(input.reason, 500), actor)
      : null,
  ].filter(Boolean) as D1PreparedStatement[];
  if (adjustmentStatements.length) await db.batch(adjustmentStatements);
  await audit("ASSESSMENT_CLOSE", "assessment", saved.id, `Competência ${competence} fechada`, saved, actor, tenantId);
  return saved;
}

export async function reopenAssessment(competence: string, reason: string, actor: string, tenantId = DEFAULT_TENANT_ID) {
  await ensureIbsCbsSchema();
  if (!text(reason)) throw new Error("O motivo da reabertura é obrigatório.");
  const db = await database();
  const row = await db.prepare(`
    UPDATE ibs_cbs_assessments SET
      status = 'Reaberta', reopened_by = ?, reopened_at = CURRENT_TIMESTAMP,
      reopen_reason = ?, updated_at = CURRENT_TIMESTAMP
    WHERE tenant_id = ? AND competence = ? AND status = 'Fechada'
    RETURNING *
  `).bind(actor, text(reason, 500), tenantId, competence).first<D1Row>();
  if (!row) throw new Error("A competência não está fechada ou não foi encontrada para reabertura.");
  const saved = assessmentFromRow(row);
  await audit("ASSESSMENT_REOPEN", "assessment", saved.id, `Competência ${competence} reaberta`, { reason }, actor, tenantId);
  return saved;
}

export async function getIbsCbsOverview(tenantId = DEFAULT_TENANT_ID, competence?: string | null) {
  await ensureIbsCbsSchema();
  const config = await getIbsCbsConfig(tenantId, competence || undefined);
  const configHistory = await listIbsCbsConfigHistory(tenantId);
  const documents = await listFiscalDocuments(tenantId, competence);
  const inferredCompetence = competence || documents[0]?.competence || "2026-01";
  const assessment = await getAssessment(inferredCompetence, tenantId);
  const summary = {
    documentsAnalyzed: documents.length,
    pendingDocuments: documents.filter((item) => ["Bloqueado para fechamento", "Pendente de conferência"].includes(item.complianceStatus)).length,
    possibleCredits: documents.reduce((sum, item) => sum + number(item.creditAmount), 0),
    blockedCredits: documents.reduce((sum, item) => sum + number(item.blockedCredit), 0),
    periodDebits: documents.filter((item) => item.direction === "outgoing").reduce((sum, item) => sum + number(item.ibsAmount) + number(item.cbsAmount), 0),
    criticalIssues: documents.reduce((sum, item) => sum + number(item.criticalCount), 0),
  };
  return { config, configHistory, documents, assessment, summary };
}

function csvCell(value: unknown) {
  const content = String(value ?? "").replace(/"/g, '""');
  return `"${content}"`;
}

export async function exportIbsCbsMemory(competence: string, tenantId = DEFAULT_TENANT_ID) {
  const documents = await listFiscalDocuments(tenantId, competence);
  const header = [
    "Competência", "Direção", "Chave fiscal", "Documento", "Parceiro",
    "Item", "NCM/NBS", "CST", "cClassTrib", "Base", "IBS", "CBS",
    "Crédito presumido", "Crédito aproveitável", "Crédito bloqueado",
    "Motivo do bloqueio", "Status fiscal",
  ].map(csvCell).join(";");
  const lines = documents.flatMap((document) => {
    const items = document.items?.length ? document.items : [document];
    return items.map((item: Record<string, unknown>) => [
      document.competence,
      document.direction,
      document.fiscalKey,
      document.documentNumber,
      document.partnerName,
      item.itemDescription,
      item.itemCode,
      item.cst,
      item.cClassTrib,
      item.taxableBase ?? document.taxableBase,
      item.ibsAmount ?? document.ibsAmount,
      item.cbsAmount ?? document.cbsAmount,
      item.presumedCredit ?? document.presumedCredit,
      item.creditAmount ?? document.creditAmount,
      item.blockedCredit ?? document.blockedCredit,
      item.blockedCreditReason ?? document.blockedCreditReason,
      document.complianceStatus,
    ].map(csvCell).join(";"));
  });
  return `\uFEFF${[header, ...lines].join("\r\n")}`;
}

export async function listIbsCbsAuditLogs(tenantId = DEFAULT_TENANT_ID) {
  await ensureIbsCbsSchema();
  const db = await database();
  const result = await db.prepare("SELECT * FROM ibs_cbs_audit_logs WHERE tenant_id = ? ORDER BY created_at DESC, id DESC LIMIT 300").bind(tenantId).all<D1Row>();
  return result.results || [];
}
