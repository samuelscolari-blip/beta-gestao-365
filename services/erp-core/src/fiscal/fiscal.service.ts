import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { and, eq } from "drizzle-orm";
import { Queue } from "bullmq";
import { createHash, randomUUID } from "node:crypto";
import { AuditService } from "../audit/audit.service";
import { DatabaseService } from "../database/database.service";
import { fiscalEvents } from "../database/schema";
import { EncryptedPayloadService } from "../security/encrypted-payload.service";
import type { ErpRequestContext } from "../security/request-context";
import {
  FISCAL_QUEUE,
  FISCAL_SIGN_JOB,
} from "./fiscal.constants";
import type { CreateFiscalEventDto } from "./fiscal.dto";

@Injectable()
export class FiscalService {
  constructor(
    private readonly database: DatabaseService,
    private readonly audit: AuditService,
    private readonly encryption: EncryptedPayloadService,
    @InjectQueue(FISCAL_QUEUE)
    private readonly queue: Queue,
  ) {}

  async createEvent(
    context: ErpRequestContext,
    input: CreateFiscalEventDto,
  ) {
    if (!input.xml.trim().startsWith("<")) {
      throw new UnprocessableEntityException("Conteúdo XML inválido.");
    }
    const encrypted = this.encryption.encrypt(input.xml);
    const xmlHash = createHash("sha256")
      .update(input.xml)
      .digest("hex");
    return this.database.withTenant(context.tenantId, async (tx) => {
      const [created] = await tx
        .insert(fiscalEvents)
        .values({
          id: randomUUID(),
          tenantId: context.tenantId,
          requestKey: context.idempotencyKey,
          system: input.system,
          eventCode: input.eventCode,
          layoutVersion: input.layoutVersion,
          environment: input.environment,
          status: "STORED",
          xmlCiphertext: encrypted.ciphertext,
          xmlIv: encrypted.iv,
          xmlTag: encrypted.tag,
          xmlHash,
          requestedBy: context.actor,
        })
        .onConflictDoNothing({
          target: [
            fiscalEvents.tenantId,
            fiscalEvents.requestKey,
          ],
        })
        .returning();
      if (created) {
        await this.audit.append(tx, {
          tenantId: context.tenantId,
          action: "FISCAL_EVENT_STORED",
          entity: "fiscal_event",
          entityId: created.id,
          actor: context.actor,
          metadata: {
            system: input.system,
            eventCode: input.eventCode,
            layoutVersion: input.layoutVersion,
            environment: input.environment,
            referenceId: input.referenceId,
            xmlHash,
          },
        });
        return this.publicEvent(created);
      }
      const [existing] = await tx
        .select()
        .from(fiscalEvents)
        .where(
          and(
            eq(fiscalEvents.tenantId, context.tenantId),
            eq(fiscalEvents.requestKey, context.idempotencyKey),
          ),
        )
        .limit(1);
      if (!existing) {
        throw new ServiceUnavailableException(
          "Não foi possível registrar o evento.",
        );
      }
      return this.publicEvent(existing);
    });
  }

  async queueSignature(
    context: ErpRequestContext,
    eventId: string,
    referenceId: string,
  ) {
    const event = await this.getRawEvent(context.tenantId, eventId);
    if (event.status === "SIGNED") return this.publicEvent(event);
    try {
      await this.queue.add(
        FISCAL_SIGN_JOB,
        {
          tenantId: context.tenantId,
          eventId,
          referenceId,
          actor: context.actor,
        },
        {
          jobId: `${eventId}-sign`,
          attempts: 3,
          backoff: { type: "exponential", delay: 3_000 },
          removeOnComplete: { age: 86_400, count: 5_000 },
          removeOnFail: { age: 604_800, count: 10_000 },
        },
      );
    } catch {
      throw new ServiceUnavailableException(
        "A fila de assinatura fiscal está temporariamente indisponível.",
      );
    }
    await this.database.withTenant(context.tenantId, async (tx) => {
      await tx
        .update(fiscalEvents)
        .set({ status: "SIGN_QUEUED", updatedAt: new Date() })
        .where(eq(fiscalEvents.id, eventId));
      await this.audit.append(tx, {
        tenantId: context.tenantId,
        action: "FISCAL_SIGNATURE_QUEUED",
        entity: "fiscal_event",
        entityId: eventId,
        actor: context.actor,
        metadata: { referenceId },
      });
    });
    return this.getEvent(context, eventId);
  }

  async getEvent(context: ErpRequestContext, eventId: string) {
    return this.publicEvent(
      await this.getRawEvent(context.tenantId, eventId),
    );
  }

  private async getRawEvent(tenantId: string, eventId: string) {
    const event = await this.database.withTenant(
      tenantId,
      async (tx) => {
        const [item] = await tx
          .select()
          .from(fiscalEvents)
          .where(
            and(
              eq(fiscalEvents.tenantId, tenantId),
              eq(fiscalEvents.id, eventId),
            ),
          )
          .limit(1);
        return item;
      },
    );
    if (!event) throw new NotFoundException("Evento fiscal não encontrado.");
    return event;
  }

  private publicEvent(event: typeof fiscalEvents.$inferSelect) {
    return {
      id: event.id,
      system: event.system,
      eventCode: event.eventCode,
      layoutVersion: event.layoutVersion,
      environment: event.environment,
      status: event.status,
      xmlHash: event.xmlHash,
      signedXmlHash: event.signedXmlHash,
      protocol: event.protocol,
      receipt: event.receipt,
      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
    };
  }
}
