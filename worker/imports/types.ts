export type ImportQueuePayload = {
  importId: string;
  fileName: string;
  originalFileName: string;
  tenantId: string;
  requestedBy: string;
  requestedAt: string;
};

export type ImportedWork = {
  codigo: string;
  nome: string;
  gestor: string;
  dataPrevisao: string;
  payload: Record<string, string>;
};

export type ImportValidationError = {
  linha: number;
  payload: Record<string, string>;
  motivo: string;
};

export type ImportProgress = {
  processados: number;
  validos: number;
  invalidos: number;
};

export type ImportResult = ImportProgress & {
  importId: string;
};

export interface ImportWorkerEnv {
  DB: D1Database;
  STORAGE_BUCKET?: R2Bucket;
  IMPORT_QUEUE?: Queue<ImportQueuePayload>;
  IMPORT_TENANT_ID?: string;
  DEPLOYMENT_PLATFORM?: string;
  TEAM_DOMAIN?: string;
  POLICY_AUD?: string;
}
