import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import {
  PAYROLL_FLOW_PRODUCER,
  PAYROLL_QUEUE,
} from "./payroll.constants";
import { PayrollController } from "./payroll.controller";
import { PayrollProcessor } from "./payroll.processor";
import { PayrollService } from "./payroll.service";

const payrollQueue = BullModule.registerQueue({
  name: PAYROLL_QUEUE,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: "exponential", delay: 2_000 },
  },
});

const payrollFlowProducer = BullModule.registerFlowProducer({
  name: PAYROLL_FLOW_PRODUCER,
});

@Module({
  imports: [payrollQueue, payrollFlowProducer],
  controllers: [PayrollController],
  providers: [PayrollService],
})
export class PayrollApiModule {}

@Module({
  imports: [payrollQueue],
  providers: [PayrollProcessor],
})
export class PayrollWorkerModule {}
