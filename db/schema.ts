import { sql } from "drizzle-orm";
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const tenants = sqliteTable("tenants", {
  id: text("id").primaryKey(),
  legalName: text("legal_name").notNull(),
  tradeName: text("trade_name").notNull().default(""),
  status: text("status").notNull().default("ACTIVE"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const records = sqliteTable(
  "records",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: text("tenant_id").notNull().default("beta-construtora"),
    module: text("module").notNull(),
    title: text("title").notNull(),
    reference: text("reference").notNull().default(""),
    status: text("status").notNull().default(""),
    recordDate: text("record_date").notNull().default(""),
    amount: real("amount").notNull().default(0),
    amountCents: integer("amount_cents").notNull().default(0),
    payload: text("payload").notNull().default("{}"),
    source: text("source").notNull().default("system"),
    createdBy: text("created_by").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("records_tenant_module_idx").on(table.tenantId, table.module),
    index("records_tenant_reference_idx").on(table.tenantId, table.reference),
    index("records_module_idx").on(table.module),
    index("records_module_status_idx").on(table.module, table.status),
    index("records_module_date_idx").on(table.module, table.recordDate),
    index("records_reference_idx").on(table.reference),
    index("records_record_date_idx").on(table.recordDate),
  ],
);

export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: text("tenant_id").notNull().default("beta-construtora"),
    action: text("action").notNull(),
    module: text("module").notNull(),
    recordId: integer("record_id"),
    summary: text("summary").notNull().default(""),
    actor: text("actor").notNull().default(""),
    previousHash: text("previous_hash").notNull().default(""),
    entryHash: text("entry_hash").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("audit_logs_tenant_created_idx").on(table.tenantId, table.createdAt),
    index("audit_logs_module_idx").on(table.module),
    index("audit_logs_created_at_idx").on(table.createdAt),
    index("audit_logs_record_idx").on(table.recordId, table.createdAt),
  ],
);

// Estruturas aditivas da Reforma Tributária (IBS/CBS).
export const ibsCbsConfigurations = sqliteTable(
  "ibs_cbs_configurations",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: text("tenant_id").notNull(),
    regime: text("regime").notNull().default("Regime regular"),
    incidenceEnabled: integer("incidence_enabled", { mode: "boolean" })
      .notNull()
      .default(true),
    effectiveFrom: text("effective_from").notNull(),
    effectiveTo: text("effective_to").notNull().default(""),
    ibsStateRate: real("ibs_state_rate").notNull().default(0.1),
    ibsMunicipalRate: real("ibs_municipal_rate").notNull().default(0),
    cbsRate: real("cbs_rate").notNull().default(0.9),
    reductionPercent: real("reduction_percent").notNull().default(0),
    defermentPercent: real("deferment_percent").notNull().default(0),
    creditEnabled: integer("credit_enabled", { mode: "boolean" })
      .notNull()
      .default(true),
    specialRegime: text("special_regime").notNull().default(""),
    notes: text("notes").notNull().default(""),
    rulesVersion: text("rules_version")
      .notNull()
      .default("BR-RTC-2026.2-NT2025.002-v1.40"),
    createdBy: text("created_by").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedBy: text("updated_by").notNull().default(""),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("ibs_cbs_config_tenant_idx").on(
      table.tenantId,
      table.effectiveFrom,
    ),
  ],
);

export const fiscalDocuments = sqliteTable(
  "fiscal_documents",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: text("tenant_id").notNull(),
    direction: text("direction").notNull(),
    fiscalKey: text("fiscal_key").notNull().default(""),
    documentNumber: text("document_number").notNull().default(""),
    series: text("series").notNull().default(""),
    issueDate: text("issue_date").notNull().default(""),
    dueDate: text("due_date").notNull().default(""),
    competence: text("competence").notNull().default(""),
    partnerName: text("partner_name").notNull().default(""),
    partnerTaxId: text("partner_tax_id").notNull().default(""),
    supplierTaxRegime: text("supplier_tax_regime").notNull().default(""),
    itemDescription: text("item_description").notNull().default(""),
    itemCode: text("item_code").notNull().default(""),
    cst: text("cst").notNull().default(""),
    cclassTrib: text("cclass_trib").notNull().default(""),
    operationValue: real("operation_value").notNull().default(0),
    reductionPercent: real("reduction_percent").notNull().default(0),
    taxableBase: real("taxable_base").notNull().default(0),
    ibsStateRate: real("ibs_state_rate").notNull().default(0),
    ibsMunicipalRate: real("ibs_municipal_rate").notNull().default(0),
    ibsAmount: real("ibs_amount").notNull().default(0),
    cbsRate: real("cbs_rate").notNull().default(0),
    cbsAmount: real("cbs_amount").notNull().default(0),
    defermentPercent: real("deferment_percent").notNull().default(0),
    creditEligible: integer("credit_eligible", { mode: "boolean" })
      .notNull()
      .default(false),
    creditAmount: real("credit_amount").notNull().default(0),
    presumedCredit: real("presumed_credit").notNull().default(0),
    blockedCredit: real("blocked_credit").notNull().default(0),
    blockedCreditReason: text("blocked_credit_reason").notNull().default(""),
    creditBasis: text("credit_basis").notNull().default(""),
    workName: text("work_name").notNull().default(""),
    costCenter: text("cost_center").notNull().default(""),
    documentUrl: text("document_url").notNull().default(""),
    complianceStatus: text("compliance_status").notNull().default(""),
    criticalCount: integer("critical_count").notNull().default(0),
    warningCount: integer("warning_count").notNull().default(0),
    validationJson: text("validation_json").notNull().default("[]"),
    calculationJson: text("calculation_json").notNull().default("{}"),
    sourceModule: text("source_module").notNull().default(""),
    isActive: integer("is_active", { mode: "boolean" })
      .notNull()
      .default(true),
    supersededBy: integer("superseded_by"),
    createdBy: text("created_by").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedBy: text("updated_by").notNull().default(""),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("fiscal_documents_tenant_key_idx").on(
      table.tenantId,
      table.fiscalKey,
    ),
    index("fiscal_documents_competence_idx").on(
      table.tenantId,
      table.competence,
    ),
    index("fiscal_documents_status_idx").on(
      table.tenantId,
      table.complianceStatus,
    ),
  ],
);

export const fiscalItems = sqliteTable(
  "fiscal_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: text("tenant_id").notNull(),
    documentId: integer("document_id")
      .notNull()
      .references(() => fiscalDocuments.id, { onDelete: "cascade" }),
    lineNumber: integer("line_number").notNull().default(1),
    itemDescription: text("item_description").notNull().default(""),
    itemCode: text("item_code").notNull().default(""),
    cst: text("cst").notNull().default(""),
    cclassTrib: text("cclass_trib").notNull().default(""),
    quantity: real("quantity").notNull().default(1),
    unitValue: real("unit_value").notNull().default(0),
    operationValue: real("operation_value").notNull().default(0),
    reductionPercent: real("reduction_percent").notNull().default(0),
    taxableBase: real("taxable_base").notNull().default(0),
    ibsStateRate: real("ibs_state_rate").notNull().default(0),
    ibsMunicipalRate: real("ibs_municipal_rate").notNull().default(0),
    ibsAmount: real("ibs_amount").notNull().default(0),
    cbsRate: real("cbs_rate").notNull().default(0),
    cbsAmount: real("cbs_amount").notNull().default(0),
    defermentPercent: real("deferment_percent").notNull().default(0),
    creditEligible: integer("credit_eligible", { mode: "boolean" })
      .notNull()
      .default(false),
    creditAmount: real("credit_amount").notNull().default(0),
    presumedCredit: real("presumed_credit").notNull().default(0),
    blockedCredit: real("blocked_credit").notNull().default(0),
    blockedCreditReason: text("blocked_credit_reason").notNull().default(""),
    creditBasis: text("credit_basis").notNull().default(""),
    validationJson: text("validation_json").notNull().default("[]"),
    calculationJson: text("calculation_json").notNull().default("{}"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("fiscal_items_document_idx").on(
      table.tenantId,
      table.documentId,
      table.lineNumber,
    ),
  ],
);

export const ibsCbsAssessments = sqliteTable(
  "ibs_cbs_assessments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: text("tenant_id").notNull(),
    competence: text("competence").notNull(),
    status: text("status").notNull().default("Aberta"),
    ibsDebits: real("ibs_debits").notNull().default(0),
    ibsCredits: real("ibs_credits").notNull().default(0),
    ibsBalance: real("ibs_balance").notNull().default(0),
    cbsDebits: real("cbs_debits").notNull().default(0),
    cbsCredits: real("cbs_credits").notNull().default(0),
    cbsBalance: real("cbs_balance").notNull().default(0),
    blockedCredits: real("blocked_credits").notNull().default(0),
    debitAdjustments: real("debit_adjustments").notNull().default(0),
    creditAdjustments: real("credit_adjustments").notNull().default(0),
    pisCofinsCompensation: real("pis_cofins_compensation")
      .notNull()
      .default(0),
    technicalBalance: real("technical_balance").notNull().default(0),
    pendingDocuments: integer("pending_documents").notNull().default(0),
    criticalIssues: integer("critical_issues").notNull().default(0),
    closeReason: text("close_reason").notNull().default(""),
    closedBy: text("closed_by").notNull().default(""),
    closedAt: text("closed_at").notNull().default(""),
    reopenedBy: text("reopened_by").notNull().default(""),
    reopenedAt: text("reopened_at").notNull().default(""),
    reopenReason: text("reopen_reason").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("ibs_cbs_assessment_tenant_competence_unique").on(
      table.tenantId,
      table.competence,
    ),
  ],
);

export const ibsCbsAuditLogs = sqliteTable(
  "ibs_cbs_audit_logs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: text("tenant_id").notNull(),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: integer("entity_id"),
    summary: text("summary").notNull().default(""),
    payloadJson: text("payload_json").notNull().default("{}"),
    actor: text("actor").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("ibs_cbs_audit_tenant_idx").on(table.tenantId, table.createdAt),
  ],
);

export const ibsCbsAdjustments = sqliteTable(
  "ibs_cbs_adjustments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: text("tenant_id").notNull(),
    competence: text("competence").notNull(),
    adjustmentType: text("adjustment_type").notNull(),
    taxType: text("tax_type").notNull().default("IBS/CBS"),
    amount: real("amount").notNull().default(0),
    reason: text("reason").notNull().default(""),
    actor: text("actor").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("ibs_cbs_adjustments_comp_idx").on(
      table.tenantId,
      table.competence,
    ),
  ],
);

export const complianceIssues = sqliteTable(
  "compliance_issues",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: text("tenant_id").notNull(),
    documentId: integer("document_id").notNull(),
    itemLine: integer("item_line").notNull().default(0),
    code: text("code").notNull(),
    severity: text("severity").notNull(),
    message: text("message").notNull(),
    fieldName: text("field_name").notNull().default(""),
    status: text("status").notNull().default("Aberta"),
    resolvedBy: text("resolved_by").notNull().default(""),
    resolvedAt: text("resolved_at").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("compliance_issues_document_idx").on(
      table.tenantId,
      table.documentId,
      table.status,
    ),
  ],
);
