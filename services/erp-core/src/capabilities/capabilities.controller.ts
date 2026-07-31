import { Controller, Get } from "@nestjs/common";
import { loadConfig } from "../config/env";

@Controller("v1/capabilities")
export class CapabilitiesController {
  @Get()
  list() {
    const config = loadConfig();
    return {
      service: "beta-erp-core",
      version: "0.2.0",
      runtime: {
        api: "NestJS",
        database: "PostgreSQL com RLS",
        queue: "BullMQ + Redis",
        encryptionAtRest: "AES-256-GCM",
        audit: "append-only + cadeia SHA-256",
      },
      payroll: {
        orchestration: "BullMQ Flow pai/filhos",
        chunkSize: 250,
        frozenInputs: true,
        idempotentBulkUpsert: true,
      },
      boundedContexts: [
        "ENGENHARIA_OBRAS",
        "PESSOAS_FOLHA",
        "FISCAL_COMPLIANCE",
        "FINANCEIRO_SUPRIMENTOS",
      ],
      fiscal: {
        certificateProvider: config.certificateProvider,
        xmlSigning:
          config.certificateProvider === "A1_PFX"
            ? "CONFIGURED"
            : "PENDING_CONFIGURATION",
        governmentTransmission: "PENDING_HOMOLOGATION",
      },
      checkedAt: new Date().toISOString(),
    };
  }
}
