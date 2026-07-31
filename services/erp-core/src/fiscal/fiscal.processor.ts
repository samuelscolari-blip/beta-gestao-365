import { Processor, WorkerHost } from "@nestjs/bullmq";
import { eq } from "drizzle-orm";
import type { Job } from "bullmq";
import { createHash } from "node:crypto";
import { AuditService } from "../audit/audit.service";
import { loadConfig } from "../config/env";
import { DatabaseService } from "../database/database.service";
import { fiscalEvents } from "../database/schema";
import { EncryptedPayloadService } from "../security/encrypted-payload.service";
import {
  FISCAL_QUEUE,
  FISCAL_SIGN_JOB,
} from "./fiscal.constants";
import { XmlSignatureService } from "./xml-signature.service";

type FiscalSignJob = {
  tenantId: string;
  eventId: string;
  referenceId: string;
  actor: string;
};

@Processor(FISCAL_QUEUE, {
  concurrency: loadConfig().fiscalWorkerConcurrency,
})
export class FiscalProcessor extends WorkerHost {
  constructor(
    private readonly database: DatabaseService,
    private readonly audit: AuditService,
    private readonly encryption: EncryptedPayloadService,
    private readonly signature: XmlSignatureService,
  ) {
    super();
  }

  override async process(job: Job<FiscalSignJob>) {
    if (job.name !== FISCAL_SIGN_JOB) return;
    const { tenantId, eventId, referenceId, actor } = job.data;
    try {
      return await this.database.withTenant(tenantId, async (tx) => {
        const [event] = await tx
          .select()
          .from(fiscalEvents)
          .where(eq(fiscalEvents.id, eventId))
          .limit(1);
        if (!event) throw new Error("Evento fiscal não encontrado.");
        if (event.status === "SIGNED") {
          return {
            eventId,
            status: event.status,
            signedXmlHash: event.signedXmlHash,
          };
        }
        await tx
          .update(fiscalEvents)
          .set({ status: "SIGNING", updatedAt: new Date() })
          .where(eq(fiscalEvents.id, eventId));
        const xml = this.encryption.decrypt({
          ciphertext: event.xmlCiphertext,
          iv: event.xmlIv,
          tag: event.xmlTag,
        });
        const signedXml = this.signature.sign(xml, referenceId);
        const encrypted = this.encryption.encrypt(signedXml);
        const signedXmlHash = createHash("sha256")
          .update(signedXml)
          .digest("hex");
        await tx
          .update(fiscalEvents)
          .set({
            status: "SIGNED",
            signedXmlCiphertext: encrypted.ciphertext,
            signedXmlIv: encrypted.iv,
            signedXmlTag: encrypted.tag,
            signedXmlHash,
            updatedAt: new Date(),
          })
          .where(eq(fiscalEvents.id, eventId));
        await this.audit.append(tx, {
          tenantId,
          action: "FISCAL_EVENT_SIGNED",
          entity: "fiscal_event",
          entityId: eventId,
          actor: "worker:fiscal",
          metadata: {
            requestedBy: actor,
            referenceId,
            signedXmlHash,
          },
        });
        return { eventId, status: "SIGNED", signedXmlHash };
      });
    } catch (error) {
      await this.database.withTenant(tenantId, async (tx) => {
        await tx
          .update(fiscalEvents)
          .set({ status: "SIGNING_FAILED", updatedAt: new Date() })
          .where(eq(fiscalEvents.id, eventId));
        await this.audit.append(tx, {
          tenantId,
          action: "FISCAL_SIGNATURE_FAILED",
          entity: "fiscal_event",
          entityId: eventId,
          actor: "worker:fiscal",
          metadata: {
            errorType:
              error instanceof Error
                ? error.constructor.name
                : "UnknownError",
          },
        });
      });
      throw error;
    }
  }
}
