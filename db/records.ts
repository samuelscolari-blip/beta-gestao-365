import { validateRecordPayload } from "../app/lib/record-validation";
import { isImportableModule } from "../app/lib/import-policy";

export type StoredRecord = {
  id: number;
  tenantId: string;
  module: string;
  title: string;
  reference: string;
  status: string;
  recordDate: string;
  amount: number;
  payload: Record<string, unknown>;
  source: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

type RecordInput = Omit<
  StoredRecord,
  "id" | "tenantId" | "createdBy" | "createdAt" | "updatedAt"
> & {
  payload: Record<string, unknown>;
};

export class RecordStoreError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "RecordStoreError";
  }
}

export type AuditLog = {
  id: number;
  tenantId: string;
  action: string;
  module: string;
  recordId: number | null;
  summary: string;
  actor: string;
  previousHash: string;
  entryHash: string;
  integrity: "SEALED" | "LEGACY";
  createdAt: string;
};

export type RecordQuery = {
  module?: string | null;
  search?: string | null;
  status?: string | null;
  page?: number;
  pageSize?: number;
  excludeSettings?: boolean;
};

const allowedModules = new Set([
  "works",
  "worklogs",
  "suppliers",
  "expenses",
  "cards",
  "rentals",
  "assets",
  "asset_events",
  "people",
  "payroll",
  "terminations",
  "food",
  "taxes",
  "purchases",
  "documents",
  "emails",
  "m365",
  "contractors",
  "compliance",
  "rules",
  "settings",
]);

export const DEFAULT_TENANT_ID = "beta-construtora";

async function database() {
  const { env } = await import("cloudflare:workers");
  if (!env.DB) {
    throw new Error("O banco de dados do sistema não está disponível.");
  }
  return env.DB;
}

async function ensureColumn(
  db: Awaited<ReturnType<typeof database>>,
  table: string,
  column: string,
  definition: string,
) {
  const info = await db
    .prepare(`PRAGMA table_info(${table})`)
    .all<{ name: string }>();
  if ((info.results || []).some((item) => item.name === column)) return;
  await db.prepare(`ALTER TABLE ${table} ADD COLUMN ${definition}`).run();
}

export async function ensureSchema() {
  const db = await database();
  await db.batch([
    db.prepare(`
      CREATE TABLE IF NOT EXISTS tenants (
        id TEXT PRIMARY KEY,
        legal_name TEXT NOT NULL,
        trade_name TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id TEXT NOT NULL DEFAULT 'beta-construtora',
        module TEXT NOT NULL,
        title TEXT NOT NULL,
        reference TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT '',
        record_date TEXT NOT NULL DEFAULT '',
        amount REAL NOT NULL DEFAULT 0,
        amount_cents INTEGER NOT NULL DEFAULT 0,
        payload TEXT NOT NULL DEFAULT '{}',
        source TEXT NOT NULL DEFAULT 'system',
        created_by TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id TEXT NOT NULL DEFAULT 'beta-construtora',
        action TEXT NOT NULL,
        module TEXT NOT NULL,
        record_id INTEGER,
        summary TEXT NOT NULL DEFAULT '',
        actor TEXT NOT NULL DEFAULT '',
        previous_hash TEXT NOT NULL DEFAULT '',
        entry_hash TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),
    db.prepare(
      `INSERT OR IGNORE INTO tenants (id, legal_name, trade_name)
       VALUES (?, ?, ?)`,
    ).bind(DEFAULT_TENANT_ID, "Beta Construtora", "Beta Construtora"),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS records_module_idx ON records (module)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS records_module_status_idx ON records (module, status)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS records_module_date_idx ON records (module, record_date)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS records_reference_idx ON records (reference)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS records_record_date_idx ON records (record_date)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS audit_logs_module_idx ON audit_logs (module)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs (created_at)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS audit_logs_record_idx ON audit_logs (record_id, created_at)",
    ),
  ]);

  await ensureColumn(
    db,
    "records",
    "tenant_id",
    "tenant_id TEXT NOT NULL DEFAULT 'beta-construtora'",
  );
  await ensureColumn(
    db,
    "audit_logs",
    "tenant_id",
    "tenant_id TEXT NOT NULL DEFAULT 'beta-construtora'",
  );
  await ensureColumn(
    db,
    "audit_logs",
    "previous_hash",
    "previous_hash TEXT NOT NULL DEFAULT ''",
  );
  await ensureColumn(
    db,
    "audit_logs",
    "entry_hash",
    "entry_hash TEXT NOT NULL DEFAULT ''",
  );

  await db.batch([
    db.prepare("DROP INDEX IF EXISTS records_module_reference_unique"),
    db.prepare(
      `CREATE UNIQUE INDEX IF NOT EXISTS records_tenant_module_reference_unique
       ON records (tenant_id, module, LOWER(TRIM(reference)))
       WHERE TRIM(reference) <> ''`,
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS records_tenant_module_idx ON records (tenant_id, module)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS records_tenant_reference_idx ON records (tenant_id, reference)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS audit_logs_tenant_created_idx ON audit_logs (tenant_id, created_at)",
    ),
    db.prepare(`
      CREATE TRIGGER IF NOT EXISTS audit_logs_immutable_update
      BEFORE UPDATE ON audit_logs
      BEGIN
        SELECT RAISE(ABORT, 'AUDIT_LOG_IMMUTABLE');
      END
    `),
    db.prepare(`
      CREATE TRIGGER IF NOT EXISTS audit_logs_immutable_delete
      BEFORE DELETE ON audit_logs
      BEGIN
        SELECT RAISE(ABORT, 'AUDIT_LOG_IMMUTABLE');
      END
    `),
  ]);
}

export async function ensureDemoRecords() {
  await ensureSchema();
  const db = await database();
  const existing = await db
    .prepare(
      `SELECT id, module, reference, status, payload, source FROM records
       WHERE tenant_id = ? AND TRIM(reference) <> ''`,
    )
    .bind(DEFAULT_TENANT_ID)
    .all<{
      id: number;
      module: string;
      reference: string;
      status: string;
      payload: string;
      source: string;
    }>();

  const pendingStatusBackfills = (existing.results || []).flatMap((row) => {
    if (row.source !== DEMO_SOURCE) return [];
    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(row.payload || "{}") as Record<string, unknown>;
    } catch {
      payload = {};
    }

    const rawStatus = String(row.status || payload.status || "");
    const normalizedStatus = rawStatus
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase();

    let status = rawStatus;
    if (row.module === "expenses") {
      status = normalizedStatus.includes("pag")
        ? "Pago"
        : normalizedStatus.includes("reprov") || normalizedStatus.includes("rejeit")
          ? "Reprovado"
          : "Aguardando validação";
    } else if (rawStatus === "Vence em 7 dias") {
      status = "Pendente";
    }

    const payloadStatus = String(payload.status || "");
    if (status === row.status && status === payloadStatus) return [];
    return [{
      id: row.id,
      module: row.module,
      status,
      payload: { ...payload, status },
    }];
  });

  if (pendingStatusBackfills.length) {
    const updatedAt = new Date().toISOString();
    await db.batch(
      pendingStatusBackfills.map((record) =>
        db
          .prepare(
            `UPDATE records
             SET status = ?, payload = ?, updated_at = ?
             WHERE tenant_id = ? AND id = ? AND source = ?`,
          )
          .bind(
            record.status,
            JSON.stringify(record.payload),
            updatedAt,
            DEFAULT_TENANT_ID,
            record.id,
            DEMO_SOURCE,
          ),
      ),
    );
    for (const record of pendingStatusBackfills) {
      await audit(
        "DEMO_REFRESH",
        record.module,
        record.id,
        `Situação fictícia padronizada como ${record.status}`,
        "Sistema",
      );
    }
  }

  const demoWorkerCounts = new Map(
    demoRecords
      .filter((record) => record.module === "contractors")
      .map((record) => [
        record.reference.trim().toLowerCase(),
        Number(record.payload.workerCount || 0),
      ]),
  );
  const workerCountBackfills = (existing.results || []).flatMap((row) => {
    if (row.module !== "contractors" || row.source !== DEMO_SOURCE) return [];
    const desiredCount = demoWorkerCounts.get(row.reference.trim().toLowerCase());
    if (!desiredCount) return [];
    try {
      const payload = JSON.parse(row.payload || "{}") as Record<string, unknown>;
      if (Number(payload.workerCount || 0) > 0) return [];
      return [{
        id: row.id,
        payload: { ...payload, workerCount: desiredCount },
      }];
    } catch {
      return [];
    }
  });

  if (workerCountBackfills.length) {
    const updatedAt = new Date().toISOString();
    await db.batch(
      workerCountBackfills.map((record) =>
        db
          .prepare(
            `UPDATE records
             SET payload = ?, updated_at = ?
             WHERE tenant_id = ? AND id = ? AND source = ?`,
          )
          .bind(
            JSON.stringify(record.payload),
            updatedAt,
            DEFAULT_TENANT_ID,
            record.id,
            DEMO_SOURCE,
          ),
      ),
    );
    for (const record of workerCountBackfills) {
      await audit(
        "DEMO_REFRESH",
        "contractors",
        record.id,
        "Quantidade fictícia de trabalhadores adicionada ao Registro de Terceiros",
        "Sistema",
      );
    }
  }

  const executiveFieldsByModule: Record<string, string[]> = {
    works: [
      "plannedProgress",
      "ownTeamProgress",
      "requiredOwnTeamCount",
      "realizedCost",
      "openCommitments",
      "estimatedCostToComplete",
      "currentStage",
      "currentStageProgress",
      "currentProcess",
      "currentScope",
      "totalPlannedDays",
      "scheduleDelayDays",
      "dailyWorkHours",
      "nextMilestone",
      "nextMilestoneDate",
      "riskLevel",
      "scheduleNotes",
    ],
    contractors: [
      "workCode",
      "currentActivity",
      "scopeWeight",
      "plannedProgress",
      "executionProgress",
      "productivityStatus",
      "delayReason",
      "expectedCompletion",
      "lastProgressUpdate",
    ],
    assets: [
      "rentalEndDate",
      "rentalPeriodDays",
      "dueDate",
      "paymentStatus",
      "paidAmount",
      "paymentDate",
    ],
  };
  const demoPayloadByKey = new Map(
    demoRecords.map((record) => [
      `${record.module}::${record.reference.trim().toLowerCase()}`,
      record.payload,
    ]),
  );
  const executiveBackfills = (existing.results || []).flatMap((row) => {
    const fields = executiveFieldsByModule[row.module];
    if (!fields || row.source !== DEMO_SOURCE) return [];
    const desiredPayload = demoPayloadByKey.get(
      `${row.module}::${row.reference.trim().toLowerCase()}`,
    );
    if (!desiredPayload) return [];
    try {
      const payload = JSON.parse(row.payload || "{}") as Record<string, unknown>;
      let changed = false;
      const nextPayload = { ...payload };
      for (const field of fields) {
        const current = nextPayload[field];
        const desired = desiredPayload[field];
        const currentBlank =
          current === null ||
          current === undefined ||
          String(current).trim() === "";
        const desiredFilled =
          desired !== null &&
          desired !== undefined &&
          String(desired).trim() !== "";
        if (currentBlank && desiredFilled) {
          nextPayload[field] = desired;
          changed = true;
        }
      }
      return changed ? [{ id: row.id, module: row.module, payload: nextPayload }] : [];
    } catch {
      return [];
    }
  });

  if (executiveBackfills.length) {
    const updatedAt = new Date().toISOString();
    await db.batch(
      executiveBackfills.map((record) =>
        db
          .prepare(
            `UPDATE records
             SET payload = ?, updated_at = ?
             WHERE tenant_id = ? AND id = ? AND source = ?`,
          )
          .bind(
            JSON.stringify(record.payload),
            updatedAt,
            DEFAULT_TENANT_ID,
            record.id,
            DEMO_SOURCE,
          ),
      ),
    );
    for (const record of executiveBackfills) {
      await audit(
        "DEMO_REFRESH",
        record.module,
        record.id,
        "Indicadores executivos fictícios adicionados ao acompanhamento da obra",
        "Sistema",
      );
    }
  }

  const existingKeys = new Set(
    (existing.results || []).map(
      (row) => `${row.module}::${row.reference.trim().toLowerCase()}`,
    ),
  );

  const missing = demoRecords.filter(
    (record) =>
      !existingKeys.has(
        `${record.module}::${record.reference.trim().toLowerCase()}`,
      ),
  );
  if (!missing.length) return;

  const statements = missing.map((record) => {
    const input = normalizeInput(record);
    return db
      .prepare(
        `INSERT INTO records
          (tenant_id, module, title, reference, status, record_date, amount, amount_cents, payload, source, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        DEFAULT_TENANT_ID,
        input.module,
        input.title,
        input.reference,
        input.status,
        input.recordDate,
        input.amount,
        Math.round(input.amount * 100),
        JSON.stringify(input.payload),
        input.source,
        "Base automática de demonstração",
      );
  });
  await db.batch(statements);
  await audit(
    "DEMO_SEED",
    "system",
    null,
    `${missing.length} registros fictícios inseridos`,
    "Sistema",
  );
}

function cleanText(value: unknown, max = 500) {
  return String(value ?? "").trim().slice(0, max);
}

function normalizePayload(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  let serialized: string;
  try {
    serialized = JSON.stringify(value);
  } catch {
    throw new RecordStoreError(
      "Os dados adicionais do registro não formam um JSON válido.",
      "INVALID_PAYLOAD",
    );
  }

  if (serialized.length > 100_000) {
    throw new RecordStoreError(
      "O registro ultrapassa o limite de 100 KB de dados adicionais.",
      "PAYLOAD_TOO_LARGE",
      413,
    );
  }

  const parsed = JSON.parse(serialized) as Record<string, unknown>;
  let fieldCount = 0;

  function inspect(current: unknown, depth: number) {
    if (depth > 8) {
      throw new RecordStoreError(
        "Os dados adicionais possuem níveis demais de agrupamento.",
        "PAYLOAD_TOO_DEEP",
      );
    }
    if (!current || typeof current !== "object") return;
    const values = Array.isArray(current)
      ? current
      : Object.values(current as Record<string, unknown>);
    fieldCount += values.length;
    if (fieldCount > 500) {
      throw new RecordStoreError(
        "O registro possui mais de 500 campos internos.",
        "PAYLOAD_TOO_COMPLEX",
      );
    }
    values.forEach((item) => inspect(item, depth + 1));
  }

  inspect(parsed, 0);
  return parsed;
}

function normalizeRecordDate(value: unknown) {
  const recordDate = cleanText(value, 10);
  if (!recordDate) return "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(recordDate)) {
    throw new RecordStoreError(
      "A data de referência deve estar no formato AAAA-MM-DD.",
      "INVALID_DATE",
    );
  }
  const parsed = new Date(`${recordDate}T00:00:00Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== recordDate
  ) {
    throw new RecordStoreError(
      "A data de referência informada não existe.",
      "INVALID_DATE",
    );
  }
  return recordDate;
}

function normalizeInput(input: Partial<RecordInput>): RecordInput {
  const moduleId = cleanText(input.module, 40);
  if (!allowedModules.has(moduleId)) {
    throw new RecordStoreError("Módulo inválido.", "INVALID_MODULE");
  }
  const title = cleanText(input.title, 240);
  if (!title) {
    throw new RecordStoreError(
      "O título do registro é obrigatório.",
      "TITLE_REQUIRED",
    );
  }
  const payload = normalizePayload(input.payload);
  const amount = Number(
    moduleId === "assets"
      ? payload.monthlyCost ?? input.amount ?? 0
      : moduleId === "asset_events"
        ? payload.maintenanceCost ?? input.amount ?? 0
        : input.amount ?? 0,
  );
  if (!Number.isFinite(amount) || amount < 0 || amount > 1_000_000_000_000) {
    throw new RecordStoreError(
      "O valor do registro deve ser positivo e menor que R$ 1 trilhão.",
      "INVALID_AMOUNT",
    );
  }
  const source = cleanText(input.source || "system", 80);
  if (source.startsWith("Planilha:") && !isImportableModule(moduleId)) {
    throw new RecordStoreError(
      "Este módulo não aceita dados importados por planilha. Use cadastro ou validação interna.",
      "IMPORT_MODULE_NOT_ALLOWED",
      403,
    );
  }
  const issues = validateRecordPayload(moduleId, payload);
  if (issues.length) {
    throw new RecordStoreError(
      issues
        .slice(0, 5)
        .map((issue) => issue.message)
        .join(" "),
      "INVALID_MODULE_DATA",
    );
  }
  return {
    module: moduleId,
    title,
    reference: cleanText(input.reference, 100),
    status: cleanText(input.status, 80),
    recordDate: normalizeRecordDate(input.recordDate),
    amount,
    payload,
    source,
  };
}

async function hydrateNewAssetEvent(
  rawInput: Partial<RecordInput>,
): Promise<Partial<RecordInput>> {
  if (cleanText(rawInput.module, 40) !== "asset_events") return rawInput;
  const payload = normalizePayload(rawInput.payload);
  const assetId = cleanText(payload.assetId, 100);
  if (!assetId) {
    throw new RecordStoreError(
      "Selecione a máquina vinculada à ocorrência.",
      "ASSET_REQUIRED",
    );
  }

  const db = await database();
  const assetRow = await db
    .prepare(
      `SELECT * FROM records
       WHERE tenant_id = ? AND module = 'assets'
         AND LOWER(TRIM(reference)) = LOWER(TRIM(?))
       LIMIT 1`,
    )
    .bind(DEFAULT_TENANT_ID, assetId)
    .first<Record<string, unknown>>();
  if (!assetRow) {
    throw new RecordStoreError(
      "A máquina vinculada não foi encontrada. Atualize a tela e selecione novamente.",
      "ASSET_NOT_FOUND",
      404,
    );
  }

  const asset = rowToRecord(assetRow);
  const rentalValue = Math.max(
    0,
    Number(asset.payload.monthlyCost || asset.amount || 0),
  );
  const rentalPeriodDays = Math.max(
    0,
    Math.floor(Number(asset.payload.rentalPeriodDays || 0)),
  );
  const idleDays = Math.max(0, Math.floor(Number(payload.idleDays || 0)));
  const dailyRentalRate =
    rentalPeriodDays > 0 ? rentalValue / rentalPeriodDays : 0;
  const estimatedDowntimeLoss = dailyRentalRate * idleDays;
  const roundMoney = (value: number) => Math.round(value * 100) / 100;

  return {
    ...rawInput,
    payload: {
      ...payload,
      assetId: String(asset.payload.assetId || asset.reference),
      assetName: String(asset.payload.description || asset.title),
      work: String(asset.payload.work || ""),
      rentalValue: roundMoney(rentalValue),
      rentalPeriodDays,
      dailyRentalRate: roundMoney(dailyRentalRate),
      estimatedDowntimeLoss: roundMoney(estimatedDowntimeLoss),
    },
  };
}

function rowToRecord(row: Record<string, unknown>): StoredRecord {
  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(String(row.payload || "{}")) as Record<string, unknown>;
  } catch {
    payload = {};
  }
  return {
    id: Number(row.id),
    tenantId: String(row.tenant_id || DEFAULT_TENANT_ID),
    module: String(row.module),
    title: String(row.title),
    reference: String(row.reference || ""),
    status: String(row.status || ""),
    recordDate: String(row.record_date || ""),
    amount:
      row.amount_cents === null || row.amount_cents === undefined
        ? Number(row.amount || 0)
        : Number(row.amount_cents || 0) / 100,
    payload,
    source: String(row.source || ""),
    createdBy: String(row.created_by || ""),
    createdAt: String(row.created_at || ""),
    updatedAt: String(row.updated_at || ""),
  };
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function audit(
  action: string,
  module: string,
  recordId: number | null,
  summary: string,
  actor: string,
) {
  const db = await database();
  const previous = await db
    .prepare(
      `SELECT entry_hash FROM audit_logs
       WHERE tenant_id = ?
       ORDER BY id DESC LIMIT 1`,
    )
    .bind(DEFAULT_TENANT_ID)
    .first<{ entry_hash: string }>();
  const previousHash = String(previous?.entry_hash || "");
  const createdAt = new Date().toISOString();
  const normalizedSummary = summary.slice(0, 500);
  const normalizedActor = actor.slice(0, 240);
  const entryHash = await sha256(
    JSON.stringify({
      tenantId: DEFAULT_TENANT_ID,
      action,
      module,
      recordId,
      summary: normalizedSummary,
      actor: normalizedActor,
      createdAt,
      previousHash,
    }),
  );
  await db
    .prepare(
      `INSERT INTO audit_logs
        (tenant_id, action, module, record_id, summary, actor, previous_hash, entry_hash, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      DEFAULT_TENANT_ID,
      action,
      module,
      recordId,
      normalizedSummary,
      normalizedActor,
      previousHash,
      entryHash,
      createdAt,
    )
    .run();
}

function rowToAuditLog(row: Record<string, unknown>): AuditLog {
  const entryHash = String(row.entry_hash || "");
  return {
    id: Number(row.id),
    tenantId: String(row.tenant_id || DEFAULT_TENANT_ID),
    action: String(row.action || ""),
    module: String(row.module || ""),
    recordId: row.record_id === null ? null : Number(row.record_id),
    summary: String(row.summary || ""),
    actor: String(row.actor || ""),
    previousHash: String(row.previous_hash || ""),
    entryHash,
    integrity: entryHash ? "SEALED" : "LEGACY",
    createdAt: String(row.created_at || ""),
  };
}

async function assertUniqueReference(
  input: RecordInput,
  excludeId?: number,
) {
  if (!input.reference) return;
  const db = await database();
  const query = excludeId
      ? db
        .prepare(
          `SELECT id FROM records
           WHERE tenant_id = ? AND module = ?
             AND LOWER(TRIM(reference)) = LOWER(TRIM(?)) AND id <> ?
           LIMIT 1`,
        )
        .bind(DEFAULT_TENANT_ID, input.module, input.reference, excludeId)
    : db
        .prepare(
          `SELECT id FROM records
           WHERE tenant_id = ? AND module = ?
             AND LOWER(TRIM(reference)) = LOWER(TRIM(?))
           LIMIT 1`,
        )
        .bind(DEFAULT_TENANT_ID, input.module, input.reference);
  const duplicate = await query.first<{ id: number }>();
  if (duplicate) {
    throw new RecordStoreError(
      `A referência "${input.reference}" já existe neste módulo.`,
      "DUPLICATE_REFERENCE",
      409,
    );
  }
}

function changedFields(previous: StoredRecord, next: RecordInput) {
  const changes: string[] = [];
  const compare = (label: string, before: unknown, after: unknown) => {
    if (JSON.stringify(before ?? null) !== JSON.stringify(after ?? null)) {
      changes.push(label);
    }
  };
  compare("Título", previous.title, next.title);
  compare("Referência", previous.reference, next.reference);
  compare("Status", previous.status, next.status);
  compare("Data", previous.recordDate, next.recordDate);
  compare("Valor", previous.amount, next.amount);
  compare("Origem", previous.source, next.source);

  const payloadKeys = new Set([
    ...Object.keys(previous.payload),
    ...Object.keys(next.payload),
  ]);
  payloadKeys.forEach((key) =>
    compare(key, previous.payload[key], next.payload[key]),
  );
  return changes;
}

export async function listRecords(module?: string | null) {
  await ensureSchema();
  const db = await database();
  const query = module && allowedModules.has(module)
    ? db
        .prepare(
          `SELECT * FROM records
           WHERE tenant_id = ? AND module = ?
           ORDER BY updated_at DESC, id DESC LIMIT 2500`,
        )
        .bind(DEFAULT_TENANT_ID, module)
    : db
        .prepare(
          `SELECT * FROM records
           WHERE tenant_id = ?
           ORDER BY updated_at DESC, id DESC LIMIT 5000`,
        )
        .bind(DEFAULT_TENANT_ID);
  const result = await query.all<Record<string, unknown>>();
  return (result.results || []).map(rowToRecord);
}

export async function queryRecords(options: RecordQuery) {
  await ensureSchema();
  const db = await database();
  const moduleId = cleanText(options.module, 40);
  if (moduleId && !allowedModules.has(moduleId)) {
    throw new RecordStoreError("Módulo inválido.", "INVALID_MODULE");
  }

  const page = Math.max(1, Math.floor(Number(options.page) || 1));
  const pageSize = Math.min(
    250,
    Math.max(10, Math.floor(Number(options.pageSize) || 50)),
  );
  const conditions: string[] = [];
  const values: Array<string | number> = [DEFAULT_TENANT_ID];
  conditions.push("tenant_id = ?");

  if (moduleId) {
    conditions.push("module = ?");
    values.push(moduleId);
  } else if (options.excludeSettings) {
    conditions.push("module <> 'settings'");
  }

  const status = cleanText(options.status, 80);
  if (status) {
    conditions.push("LOWER(status) = LOWER(?)");
    values.push(status);
  }

  const search = cleanText(options.search, 120);
  if (search) {
    conditions.push(
      "(LOWER(title) LIKE ? OR LOWER(reference) LIKE ? OR LOWER(payload) LIKE ?)",
    );
    const term = `%${search.toLowerCase()}%`;
    values.push(term, term, term);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const totalRow = await db
    .prepare(`SELECT COUNT(*) AS total FROM records ${where}`)
    .bind(...values)
    .first<{ total: number }>();
  const offset = (page - 1) * pageSize;
  const result = await db
    .prepare(
      `SELECT * FROM records ${where}
       ORDER BY updated_at DESC, id DESC LIMIT ? OFFSET ?`,
    )
    .bind(...values, pageSize, offset)
    .all<Record<string, unknown>>();

  const total = Number(totalRow?.total || 0);
  return {
    records: (result.results || []).map(rowToRecord),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getRecordModule(id: number) {
  await ensureSchema();
  const db = await database();
  const record = await db
    .prepare("SELECT module FROM records WHERE tenant_id = ? AND id = ?")
    .bind(DEFAULT_TENANT_ID, id)
    .first<{ module: string }>();
  return record?.module || null;
}

export async function createRecord(
  rawInput: Partial<RecordInput>,
  actor: string,
) {
  await ensureSchema();
  const input = normalizeInput(await hydrateNewAssetEvent(rawInput));
  await assertUniqueReference(input);
  const db = await database();
  const result = await db
    .prepare(
      `INSERT INTO records
        (tenant_id, module, title, reference, status, record_date, amount, amount_cents, payload, source, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING *`,
    )
    .bind(
      DEFAULT_TENANT_ID,
      input.module,
      input.title,
      input.reference,
      input.status,
      input.recordDate,
      input.amount,
      Math.round(input.amount * 100),
      JSON.stringify(input.payload),
      input.source,
      actor,
    )
    .first<Record<string, unknown>>();
  if (!result) throw new Error("Não foi possível criar o registro.");
  const record = rowToRecord(result);
  await audit("CREATE", record.module, record.id, record.title, actor);
  return record;
}

export async function createMany(
  inputs: Array<Partial<RecordInput>>,
  actor: string,
) {
  await ensureSchema();
  const hydrated = await Promise.all(
    inputs.slice(0, 1000).map(hydrateNewAssetEvent),
  );
  const normalized = hydrated.map(normalizeInput);
  if (!normalized.length) return [];
  const db = await database();
  const existingResult = await db
    .prepare(
      `SELECT module, reference FROM records
       WHERE tenant_id = ? AND TRIM(reference) <> ''`,
    )
    .bind(DEFAULT_TENANT_ID)
    .all<{ module: string; reference: string }>();
  const seenReferences = new Set(
    (existingResult.results || []).map(
      (row) => `${row.module}::${row.reference.trim().toLowerCase()}`,
    ),
  );
  for (const input of normalized) {
    if (!input.reference) continue;
    const key = `${input.module}::${input.reference.toLowerCase()}`;
    if (seenReferences.has(key)) {
      throw new RecordStoreError(
        `A referência "${input.reference}" já existe no módulo ${input.module}. A importação foi cancelada para evitar duplicidade.`,
        "DUPLICATE_REFERENCE",
        409,
      );
    }
    seenReferences.add(key);
  }
  const statements = normalized.map((input) =>
    db
      .prepare(
        `INSERT INTO records
          (tenant_id, module, title, reference, status, record_date, amount, amount_cents, payload, source, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        DEFAULT_TENANT_ID,
        input.module,
        input.title,
        input.reference,
        input.status,
        input.recordDate,
        input.amount,
        Math.round(input.amount * 100),
        JSON.stringify(input.payload),
        input.source,
        actor,
      ),
  );
  await db.batch(statements);
  await audit(
    "IMPORT",
    normalized[0].module,
    null,
    `${normalized.length} registros importados`,
    actor,
  );
  return { count: normalized.length };
}

export async function updateRecord(
  id: number,
  rawInput: Partial<RecordInput>,
  actor: string,
  expectedUpdatedAt?: string,
) {
  await ensureSchema();
  const input = normalizeInput(rawInput);
  const db = await database();
  const existingRow = await db
    .prepare("SELECT * FROM records WHERE tenant_id = ? AND id = ?")
    .bind(DEFAULT_TENANT_ID, id)
    .first<Record<string, unknown>>();
  if (!existingRow) {
    throw new RecordStoreError(
      "Registro não encontrado.",
      "RECORD_NOT_FOUND",
      404,
    );
  }
  const previous = rowToRecord(existingRow);
  const previousDecision = cleanText(
    previous.payload.managementDecision,
    24,
  ).toUpperCase();
  const nextDecision = cleanText(
    input.payload.managementDecision,
    24,
  ).toUpperCase();
  const decisionReason = cleanText(
    input.payload.managementDecisionReason,
    500,
  );
  if (
    nextDecision === "REJECTED" &&
    nextDecision !== previousDecision &&
    !decisionReason
  ) {
    throw new RecordStoreError(
      "Informe o motivo da reprovação antes de registrar a decisão gerencial.",
      "DECISION_REASON_REQUIRED",
    );
  }
  if (expectedUpdatedAt && previous.updatedAt !== expectedUpdatedAt) {
    throw new RecordStoreError(
      "Este registro foi alterado por outra sessão. Atualize a tela antes de salvar novamente.",
      "STALE_RECORD",
      409,
    );
  }
  await assertUniqueReference(input, id);
  const updateSql = `UPDATE records SET
    module = ?, title = ?, reference = ?, status = ?, record_date = ?,
    amount = ?, amount_cents = ?, payload = ?, source = ?, updated_at = CURRENT_TIMESTAMP
    WHERE tenant_id = ? AND id = ?${expectedUpdatedAt ? " AND updated_at = ?" : ""}
    RETURNING *`;
  const bindings: Array<string | number> = [
    input.module,
    input.title,
    input.reference,
    input.status,
    input.recordDate,
    input.amount,
    Math.round(input.amount * 100),
    JSON.stringify(input.payload),
    input.source,
    DEFAULT_TENANT_ID,
    id,
  ];
  if (expectedUpdatedAt) bindings.push(expectedUpdatedAt);
  const result = await db
    .prepare(updateSql)
    .bind(...bindings)
    .first<Record<string, unknown>>();
  if (!result) {
    if (expectedUpdatedAt) {
      throw new RecordStoreError(
        "Este registro mudou enquanto você editava. Atualize a tela para preservar os dados mais recentes.",
        "STALE_RECORD",
        409,
      );
    }
    throw new RecordStoreError(
      "Registro não encontrado.",
      "RECORD_NOT_FOUND",
      404,
    );
  }
  const record = rowToRecord(result);
  const fields = changedFields(previous, input);
  const decisionChanged =
    nextDecision !== previousDecision &&
    ["APPROVED", "REJECTED"].includes(nextDecision);
  const auditAction =
    nextDecision === "APPROVED"
      ? "APPROVE"
      : nextDecision === "REJECTED"
        ? "REJECT"
        : "UPDATE";
  const summary = decisionChanged
    ? nextDecision === "APPROVED"
      ? `${record.title} • pedido aprovado pela gerência`
      : `${record.title} • pedido reprovado pela gerência • Motivo: ${decisionReason}`
    : fields.length
      ? `${record.title} • ${fields.length} campo(s): ${fields.slice(0, 10).join(", ")}`
      : `${record.title} • registro conferido sem alteração de conteúdo`;
  await audit(
    decisionChanged ? auditAction : "UPDATE",
    record.module,
    record.id,
    summary,
    actor,
  );
  return record;
}

export async function deleteRecord(id: number, actor: string) {
  await ensureSchema();
  const db = await database();
  const existing = await db
    .prepare(
      "SELECT module, title FROM records WHERE tenant_id = ? AND id = ?",
    )
    .bind(DEFAULT_TENANT_ID, id)
    .first<{ module: string; title: string }>();
  if (!existing) {
    throw new RecordStoreError(
      "Registro não encontrado.",
      "RECORD_NOT_FOUND",
      404,
    );
  }
  await db
    .prepare("DELETE FROM records WHERE tenant_id = ? AND id = ?")
    .bind(DEFAULT_TENANT_ID, id)
    .run();
  await audit("DELETE", existing.module, id, existing.title, actor);
  return { id };
}

export async function listAuditLogs(options?: {
  recordId?: number;
  module?: string;
  limit?: number;
}) {
  await ensureSchema();
  const db = await database();
  const conditions: string[] = ["tenant_id = ?"];
  const values: Array<string | number> = [DEFAULT_TENANT_ID];
  if (options?.recordId) {
    conditions.push("record_id = ?");
    values.push(options.recordId);
  }
  if (options?.module && allowedModules.has(options.module)) {
    conditions.push("module = ?");
    values.push(options.module);
  }
  const limit = Math.min(Math.max(Number(options?.limit || 200), 1), 500);
  const sql = `SELECT * FROM audit_logs
    ${conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""}
    ORDER BY created_at DESC, id DESC LIMIT ?`;
  values.push(limit);
  const result = await db
    .prepare(sql)
    .bind(...values)
    .all<Record<string, unknown>>();
  return (result.results || []).map(rowToAuditLog);
}
import { DEMO_SOURCE, demoRecords } from "./demo-records";
