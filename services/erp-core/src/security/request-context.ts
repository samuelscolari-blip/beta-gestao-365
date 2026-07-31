import type { Request } from "express";

export type ErpRequestContext = {
  tenantId: string;
  actor: string;
  clientId: string;
  idempotencyKey: string;
};

export type AuthenticatedRequest = Request & {
  rawBody?: Buffer;
  erpContext?: ErpRequestContext;
};

export function requestContext(request: AuthenticatedRequest) {
  if (!request.erpContext) {
    throw new Error("Contexto autenticado não disponível.");
  }
  return request.erpContext;
}
