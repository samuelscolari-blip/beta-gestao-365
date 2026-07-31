import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const tenantColumns = {
  tenantId: uuid("tenant_id").notNull(),
};

export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  legalName: text("legal_name").notNull(),
  tradeName: text("trade_name").notNull().default(""),
  cnpj: text("cnpj").notNull().default(""),
  status: text("status").notNull().default("ACTIVE"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const works = pgTable(
  "works",
  {
    id: uuid("id").primaryKey(),
    ...tenantColumns,
    name: text("name").notNull(),
    cno: text("cno").notNull().default(""),
    costCenter: text("cost_center").notNull().default(""),
    status: text("status").notNull().default("ACTIVE"),
    payload: jsonb("payload").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("works_tenant_status_idx").on(table.tenantId, table.status),
    index("works_tenant_cno_idx").on(table.tenantId, table.cno),
  ],
);

export const employees = pgTable(
  "employees",
  {
    id: uuid("id").primaryKey(),
    ...tenantColumns,
    workId: uuid("work_id"),
    employeeCode: text("employee_code").notNull(),
    name: text("name").notNull(),
    role: text("role").notNull().default(""),
    status: text("status").notNull().default("ACTIVE"),
    baseSalary: numeric("base_salary", {
      precision: 15,
      scale: 2,
    }).notNull(),
    monthlyHours: numeric("monthly_hours", {
      precision: 8,
      scale: 2,
    }).notNull().default("220"),
    payrollProfile: jsonb("payroll_profile").notNull().default({}),
    sensitivePayloadCiphertext: text("sensitive_payload_ciphertext")
      .notNull()
      .default(""),
    sensitivePayloadIv: text("sensitive_payload_iv").notNull().default(""),
    sensitivePayloadTag: text("sensitive_payload_tag").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("employees_tenant_code_uidx").on(
      table.tenantId,
      table.employeeCode,
    ),
    index("employees_tenant_status_idx").on(table.tenantId, table.status),
    index("employees_tenant_work_idx").on(table.tenantId, table.workId),
  ],
);

export const ruleVersions = pgTable(
  "rule_versions",
  {
    id: uuid("id").primaryKey(),
    ...tenantColumns,
    code: text("code").notNull(),
    version: integer("version").notNull(),
    domain: text("domain").notNull(),
    status: text("status").notNull().default("DRAFT"),
    effectiveFrom: timestamp("effective_from", {
      withTimezone: true,
    }).notNull(),
    effectiveUntil: timestamp("effective_until", {
      withTimezone: true,
    }),
    scope: jsonb("scope").notNull().default({}),
    definition: jsonb("definition").notNull().default({}),
    sourceUrl: text("source_url").notNull().default(""),
    approvedBy: text("approved_by").notNull().default(""),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("rule_versions_tenant_code_version_uidx").on(
      table.tenantId,
      table.code,
      table.version,
    ),
    index("rule_versions_tenant_domain_idx").on(
      table.tenantId,
      table.domain,
      table.status,
    ),
  ],
);

export const payrollRuns = pgTable(
  "payroll_runs",
  {
    id: uuid("id").primaryKey(),
    ...tenantColumns,
    requestKey: text("request_key").notNull(),
    competence: text("competence").notNull(),
    workId: uuid("work_id"),
    rulesVersion: text("rules_version").notNull(),
    status: text("status").notNull().default("QUEUED"),
    employeeCount: integer("employee_count").notNull().default(0),
    totalChunks: integer("total_chunks").notNull().default(0),
    totals: jsonb("totals").notNull().default({}),
    resultHash: text("result_hash").notNull().default(""),
    requestedBy: text("requested_by").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    failureCode: text("failure_code").notNull().default(""),
    failureMessage: text("failure_message").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("payroll_runs_tenant_request_uidx").on(
      table.tenantId,
      table.requestKey,
    ),
    index("payroll_runs_tenant_competence_idx").on(
      table.tenantId,
      table.competence,
      table.status,
    ),
  ],
);

export const payrollChunks = pgTable(
  "payroll_chunks",
  {
    id: uuid("id").primaryKey(),
    ...tenantColumns,
    payrollRunId: uuid("payroll_run_id").notNull(),
    chunkIndex: integer("chunk_index").notNull(),
    status: text("status").notNull().default("QUEUED"),
    expectedCount: integer("expected_count").notNull(),
    processedCount: integer("processed_count").notNull().default(0),
    attempts: integer("attempts").notNull().default(0),
    totals: jsonb("totals").notNull().default({}),
    resultHash: text("result_hash").notNull().default(""),
    failureCode: text("failure_code").notNull().default(""),
    failureMessage: text("failure_message").notNull().default(""),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("payroll_chunks_run_index_uidx").on(
      table.payrollRunId,
      table.chunkIndex,
    ),
    index("payroll_chunks_tenant_run_status_idx").on(
      table.tenantId,
      table.payrollRunId,
      table.status,
    ),
  ],
);

export const payrollRunInputs = pgTable(
  "payroll_run_inputs",
  {
    id: uuid("id").primaryKey(),
    ...tenantColumns,
    payrollRunId: uuid("payroll_run_id").notNull(),
    employeeId: uuid("employee_id").notNull(),
    workId: uuid("work_id"),
    chunkIndex: integer("chunk_index").notNull(),
    inputSnapshot: jsonb("input_snapshot").notNull(),
    inputHash: text("input_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("payroll_run_inputs_run_employee_uidx").on(
      table.payrollRunId,
      table.employeeId,
    ),
    index("payroll_run_inputs_tenant_run_chunk_idx").on(
      table.tenantId,
      table.payrollRunId,
      table.chunkIndex,
    ),
  ],
);

export const payrollItems = pgTable(
  "payroll_items",
  {
    id: uuid("id").primaryKey(),
    ...tenantColumns,
    payrollRunId: uuid("payroll_run_id").notNull(),
    employeeId: uuid("employee_id").notNull(),
    workId: uuid("work_id"),
    gross: numeric("gross", { precision: 15, scale: 2 }).notNull(),
    deductions: numeric("deductions", {
      precision: 15,
      scale: 2,
    }).notNull(),
    net: numeric("net", { precision: 15, scale: 2 }).notNull(),
    employerCost: numeric("employer_cost", {
      precision: 15,
      scale: 2,
    }).notNull(),
    calculation: jsonb("calculation").notNull(),
    calculationHash: text("calculation_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("payroll_items_run_employee_uidx").on(
      table.payrollRunId,
      table.employeeId,
    ),
    index("payroll_items_tenant_run_idx").on(
      table.tenantId,
      table.payrollRunId,
    ),
  ],
);

export const fiscalEvents = pgTable(
  "fiscal_events",
  {
    id: uuid("id").primaryKey(),
    ...tenantColumns,
    requestKey: text("request_key").notNull(),
    system: text("system").notNull(),
    eventCode: text("event_code").notNull(),
    layoutVersion: text("layout_version").notNull(),
    environment: text("environment").notNull().default("RESTRICTED"),
    status: text("status").notNull().default("DRAFT"),
    xmlCiphertext: text("xml_ciphertext").notNull().default(""),
    xmlIv: text("xml_iv").notNull().default(""),
    xmlTag: text("xml_tag").notNull().default(""),
    xmlHash: text("xml_hash").notNull().default(""),
    signedXmlCiphertext: text("signed_xml_ciphertext").notNull().default(""),
    signedXmlIv: text("signed_xml_iv").notNull().default(""),
    signedXmlTag: text("signed_xml_tag").notNull().default(""),
    signedXmlHash: text("signed_xml_hash").notNull().default(""),
    protocol: text("protocol").notNull().default(""),
    receipt: text("receipt").notNull().default(""),
    requestedBy: text("requested_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("fiscal_events_tenant_request_uidx").on(
      table.tenantId,
      table.requestKey,
    ),
    index("fiscal_events_tenant_status_idx").on(
      table.tenantId,
      table.system,
      table.status,
    ),
  ],
);

export const legacyRecords = pgTable(
  "legacy_records",
  {
    id: uuid("id").primaryKey(),
    ...tenantColumns,
    sourceSystem: text("source_system").notNull(),
    sourceId: text("source_id").notNull(),
    module: text("module").notNull(),
    payloadCiphertext: text("payload_ciphertext").notNull(),
    payloadIv: text("payload_iv").notNull(),
    payloadTag: text("payload_tag").notNull(),
    payloadHash: text("payload_hash").notNull(),
    migratedAt: timestamp("migrated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("legacy_records_tenant_source_uidx").on(
      table.tenantId,
      table.sourceSystem,
      table.sourceId,
    ),
    index("legacy_records_tenant_module_idx").on(
      table.tenantId,
      table.module,
    ),
  ],
);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").primaryKey(),
    ...tenantColumns,
    sequence: integer("sequence").notNull(),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: text("entity_id").notNull(),
    actor: text("actor").notNull(),
    metadata: jsonb("metadata").notNull().default({}),
    previousHash: text("previous_hash").notNull(),
    entryHash: text("entry_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("audit_events_tenant_sequence_uidx").on(
      table.tenantId,
      table.sequence,
    ),
    uniqueIndex("audit_events_tenant_hash_uidx").on(
      table.tenantId,
      table.entryHash,
    ),
    index("audit_events_tenant_entity_idx").on(
      table.tenantId,
      table.entity,
      table.entityId,
    ),
  ],
);

export const integrationRequests = pgTable(
  "integration_requests",
  {
    id: uuid("id").primaryKey(),
    ...tenantColumns,
    requestKey: text("request_key").notNull(),
    operation: text("operation").notNull(),
    responseCode: integer("response_code").notNull().default(0),
    completed: boolean("completed").notNull().default(false),
    response: jsonb("response").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("integration_requests_tenant_request_uidx").on(
      table.tenantId,
      table.requestKey,
    ),
  ],
);
