import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { AuditModule } from "./audit/audit.module";
import { CapabilitiesModule } from "./capabilities/capabilities.module";
import { redisConnectionOptions } from "./config/env";
import { DatabaseModule } from "./database/database.module";
import { FiscalApiModule } from "./fiscal/fiscal.module";
import { HealthModule } from "./health/health.module";
import { MigrationModule } from "./migration/migration.module";
import { PayrollApiModule } from "./payroll/payroll.module";
import { ServiceAuthGuard } from "./security/service-auth.guard";

@Module({
  imports: [
    DatabaseModule,
    AuditModule,
    BullModule.forRoot({
      connection: redisConnectionOptions("producer"),
    }),
    HealthModule,
    CapabilitiesModule,
    PayrollApiModule,
    FiscalApiModule,
    MigrationModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ServiceAuthGuard,
    },
  ],
})
export class AppModule {}
