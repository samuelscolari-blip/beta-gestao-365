import { Controller, Get, Req } from "@nestjs/common";
import type { AuthenticatedRequest } from "../security/request-context";
import { requestContext } from "../security/request-context";
import { DatabaseService } from "../database/database.service";
import { AuditService } from "./audit.service";

@Controller("v1/audit")
export class AuditController {
  constructor(
    private readonly database: DatabaseService,
    private readonly audit: AuditService,
  ) {}

  @Get("integrity")
  async integrity(@Req() request: AuthenticatedRequest) {
    const context = requestContext(request);
    return this.database.withTenant(context.tenantId, (tx) =>
      this.audit.verify(tx, context.tenantId),
    );
  }
}
