import type {
  ImportProgress,
  ImportValidationError,
  ImportedWork,
} from './types';

const MODULE_WORKS = 'works';
const MODULE_IMPORT_JOBS = 'import_jobs';
const MODULE_IMPORT_ERRORS = 'import_errors';
const DB_CHUNK_SIZE = 80;

function chunksOf<T>(items: T[], size = DB_CHUNK_SIZE) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function parsePayload(value: unknown) {
  try {
    return value ? (JSON.parse(String(value)) as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export class ObraRepository {
  constructor(
    private readonly db: D1Database,
    private readonly tenantId: string,
    private readonly actor: string,
  ) {}

  async iniciarImportacao(
    importId: string,
    originalFileName: string,
    storageKey: string,
  ) {
    const payload = JSON.stringify({
      importId,
      originalFileName,
      storageKey,
      processados: 0,
      validos: 0,
      invalidos: 0,
    });

    await this.db
      .prepare(
        `INSERT INTO records (
          tenant_id, module, title, reference, status, record_date,
          amount, amount_cents, payload, source, created_by
        )
        SELECT ?, ?, ?, ?, 'Na fila', ?, 0, 0, ?, 'importacao_csv_fila', ?
        WHERE NOT EXISTS (
          SELECT 1 FROM records
          WHERE tenant_id = ? AND module = ? AND reference = ?
        )`,
      )
      .bind(
        this.tenantId,
        MODULE_IMPORT_JOBS,
        originalFileName,
        importId,
        new Date().toISOString().slice(0, 10),
        payload,
        this.actor,
        this.tenantId,
        MODULE_IMPORT_JOBS,
        importId,
      )
      .run();
  }

  private async currentImportPayload(importId: string) {
    const current = await this.db
      .prepare(
        `SELECT payload FROM records
         WHERE tenant_id = ? AND module = ? AND reference = ?
         LIMIT 1`,
      )
      .bind(this.tenantId, MODULE_IMPORT_JOBS, importId)
      .first<{ payload?: string }>();

    return parsePayload(current?.payload);
  }

  async atualizarImportacao(
    importId: string,
    status: string,
    progress: ImportProgress,
    extra: Record<string, unknown> = {},
  ) {
    const previousPayload = await this.currentImportPayload(importId);

    await this.db
      .prepare(
        `UPDATE records
         SET status = ?, payload = ?, updated_at = CURRENT_TIMESTAMP
         WHERE tenant_id = ? AND module = ? AND reference = ?`,
      )
      .bind(
        status,
        JSON.stringify({ ...previousPayload, ...progress, ...extra }),
        this.tenantId,
        MODULE_IMPORT_JOBS,
        importId,
      )
      .run();
  }

  async registrarFalha(importId: string, status: string, error: string) {
    const previousPayload = await this.currentImportPayload(importId);
    await this.db
      .prepare(
        `UPDATE records
         SET status = ?, payload = ?, updated_at = CURRENT_TIMESTAMP
         WHERE tenant_id = ? AND module = ? AND reference = ?`,
      )
      .bind(
        status,
        JSON.stringify({
          ...previousPayload,
          error,
          lastFailureAt: new Date().toISOString(),
        }),
        this.tenantId,
        MODULE_IMPORT_JOBS,
        importId,
      )
      .run();
  }

  async buscarImportacao(importId: string) {
    const record = await this.db
      .prepare(
        `SELECT title, reference, status, record_date, payload, created_by,
                created_at, updated_at
         FROM records
         WHERE tenant_id = ? AND module = ? AND reference = ?
         LIMIT 1`,
      )
      .bind(this.tenantId, MODULE_IMPORT_JOBS, importId)
      .first<{
        title?: string;
        reference?: string;
        status?: string;
        record_date?: string;
        payload?: string;
        created_by?: string;
        created_at?: string;
        updated_at?: string;
      }>();

    if (!record) return null;

    const errorCount = await this.db
      .prepare(
        `SELECT COUNT(*) AS total
         FROM records
         WHERE tenant_id = ? AND module = ? AND reference LIKE ?`,
      )
      .bind(this.tenantId, MODULE_IMPORT_ERRORS, `${importId}:%`)
      .first<{ total?: number }>();

    return {
      import_id: record.reference || importId,
      arquivo: record.title || '',
      status: record.status || '',
      data: record.record_date || '',
      solicitado_por: record.created_by || '',
      criado_em: record.created_at || '',
      atualizado_em: record.updated_at || '',
      erros_registrados: Number(errorCount?.total || 0),
      ...parsePayload(record.payload),
    };
  }

  async bulkUpsert(obras: ImportedWork[]) {
    if (!obras.length) return;

    const uniqueWorks = [...new Map(obras.map((obra) => [obra.codigo, obra])).values()];

    for (const chunk of chunksOf(uniqueWorks)) {
      const placeholders = chunk.map(() => '?').join(', ');
      const existingResult = await this.db
        .prepare(
          `SELECT reference FROM records
           WHERE tenant_id = ? AND module = ? AND reference IN (${placeholders})`,
        )
        .bind(
          this.tenantId,
          MODULE_WORKS,
          ...chunk.map((obra) => obra.codigo),
        )
        .all();

      const existingReferences = new Set(
        (existingResult.results || []).map((row) =>
          String((row as { reference?: unknown }).reference || ''),
        ),
      );

      const statements = chunk.map((obra) => {
        const payload = JSON.stringify({
          ...obra.payload,
          workId: obra.codigo,
          code: obra.codigo,
          manager: obra.gestor,
          managerName: obra.gestor,
          forecastDate: obra.dataPrevisao,
          expectedEndDate: obra.dataPrevisao,
        });

        if (existingReferences.has(obra.codigo)) {
          return this.db
            .prepare(
              `UPDATE records
               SET title = ?, status = 'Ativa', record_date = ?, payload = ?,
                   source = 'importacao_csv_fila', updated_at = CURRENT_TIMESTAMP
               WHERE tenant_id = ? AND module = ? AND reference = ?`,
            )
            .bind(
              obra.nome,
              obra.dataPrevisao,
              payload,
              this.tenantId,
              MODULE_WORKS,
              obra.codigo,
            );
        }

        return this.db
          .prepare(
            `INSERT INTO records (
              tenant_id, module, title, reference, status, record_date,
              amount, amount_cents, payload, source, created_by
            ) VALUES (?, ?, ?, ?, 'Ativa', ?, 0, 0, ?, 'importacao_csv_fila', ?)`,
          )
          .bind(
            this.tenantId,
            MODULE_WORKS,
            obra.nome,
            obra.codigo,
            obra.dataPrevisao,
            payload,
            this.actor,
          );
      });

      if (statements.length) await this.db.batch(statements);
    }
  }

  async registrarErros(importId: string, erros: ImportValidationError[]) {
    if (!erros.length) return;

    for (const chunk of chunksOf(erros, 40)) {
      const statements: D1PreparedStatement[] = [];

      for (const erro of chunk) {
        const reference = `${importId}:${erro.linha}`;
        statements.push(
          this.db
            .prepare(
              `DELETE FROM records
               WHERE tenant_id = ? AND module = ? AND reference = ?`,
            )
            .bind(this.tenantId, MODULE_IMPORT_ERRORS, reference),
        );
        statements.push(
          this.db
            .prepare(
              `INSERT INTO records (
                tenant_id, module, title, reference, status, record_date,
                amount, amount_cents, payload, source, created_by
              ) VALUES (?, ?, ?, ?, 'Pendente', ?, 0, 0, ?, 'importacao_csv_fila', ?)`,
            )
            .bind(
              this.tenantId,
              MODULE_IMPORT_ERRORS,
              `Erro na linha ${erro.linha}: ${erro.motivo}`,
              reference,
              new Date().toISOString().slice(0, 10),
              JSON.stringify({
                importId,
                linha: erro.linha,
                motivo: erro.motivo,
                payload: erro.payload,
              }),
              this.actor,
            ),
        );
      }

      await this.db.batch(statements);
    }
  }
}
