import { Global, Module } from "@nestjs/common";
import { AuditService } from "./audit.service";
import { EncryptedPayloadService } from "../security/encrypted-payload.service";
import { AuditController } from "./audit.controller";

@Global()
@Module({
  controllers: [AuditController],
  providers: [AuditService, EncryptedPayloadService],
  exports: [AuditService, EncryptedPayloadService],
})
export class AuditModule {}
