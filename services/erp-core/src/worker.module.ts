import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { AuditModule } from "./audit/audit.module";
import { redisConnectionOptions } from "./config/env";
import { DatabaseModule } from "./database/database.module";
import { FiscalWorkerModule } from "./fiscal/fiscal.module";
import { PayrollWorkerModule } from "./payroll/payroll.module";
import { WorkerHeartbeatService } from "./health/worker-heartbeat.service";

@Module({
  imports: [
    DatabaseModule,
    AuditModule,
    BullModule.forRoot({
      connection: redisConnectionOptions("worker"),
    }),
    PayrollWorkerModule,
    FiscalWorkerModule,
  ],
  providers: [WorkerHeartbeatService],
})
export class WorkerModule {}
