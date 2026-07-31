import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { FiscalController } from "./fiscal.controller";
import {
  FISCAL_QUEUE,
} from "./fiscal.constants";
import { FiscalProcessor } from "./fiscal.processor";
import { FiscalService } from "./fiscal.service";
import { XmlSignatureService } from "./xml-signature.service";

const fiscalQueue = BullModule.registerQueue({
  name: FISCAL_QUEUE,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 3_000 },
  },
});

@Module({
  imports: [fiscalQueue],
  controllers: [FiscalController],
  providers: [
    FiscalService,
  ],
})
export class FiscalApiModule {}

@Module({
  imports: [fiscalQueue],
  providers: [FiscalProcessor, XmlSignatureService],
})
export class FiscalWorkerModule {}
