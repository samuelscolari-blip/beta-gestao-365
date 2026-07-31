import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Response } from "express";
import { loadConfig } from "../config/env";
import { PUBLIC_ROUTE } from "./public-route";
import type { AuthenticatedRequest } from "./request-context";
import {
  createServiceSignature,
  signaturesMatch,
  timestampIsFresh,
} from "./service-signature";

@Injectable()
export class ServiceAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const response = context.switchToHttp().getResponse<Response>();
    const config = loadConfig();
    const clientId = request.header("x-erp-client-id") || "";
    const timestamp = request.header("x-erp-timestamp") || "";
    const tenantId = request.header("x-erp-tenant-id") || "";
    const actor = request.header("x-erp-actor") || "";
    const idempotencyKey =
      request.header("x-erp-idempotency-key") || "";
    const receivedSignature = request.header("x-erp-signature") || "";

    if (
      clientId !== config.serviceClientId ||
      !timestampIsFresh(timestamp) ||
      !tenantId ||
      !actor ||
      !receivedSignature
    ) {
      throw new UnauthorizedException("Assinatura de serviço inválida.");
    }

    const method = request.method.toUpperCase();
    if (
      !["GET", "HEAD"].includes(method) &&
      !/^[a-zA-Z0-9_-]{16,120}$/.test(idempotencyKey)
    ) {
      throw new UnauthorizedException(
        "Chave de idempotência ausente ou inválida.",
      );
    }

    const expected = createServiceSignature(
      {
        timestamp,
        method,
        pathWithQuery: request.originalUrl,
        tenantId,
        actor,
        idempotencyKey,
        body: request.rawBody || Buffer.alloc(0),
      },
      config.serviceHmacSecret,
    );
    if (!signaturesMatch(expected, receivedSignature)) {
      throw new UnauthorizedException("Assinatura de serviço inválida.");
    }

    request.erpContext = {
      tenantId,
      actor: actor.slice(0, 200),
      clientId,
      idempotencyKey,
    };
    response.setHeader("cache-control", "no-store");
    return true;
  }
}
