import { Body, Controller, Post, Req } from "@nestjs/common";
import type { AuthenticatedRequest } from "../security/request-context";
import { requestContext } from "../security/request-context";
import { MigrationService } from "./migration.service";

@Controller("v1/migrations")
export class MigrationController {
  constructor(private readonly migration: MigrationService) {}

  @Post("d1-records")
  async importD1(
    @Req() request: AuthenticatedRequest,
    @Body() body: { records?: unknown },
  ) {
    return this.migration.importD1Records(
      requestContext(request),
      body.records,
    );
  }
}
