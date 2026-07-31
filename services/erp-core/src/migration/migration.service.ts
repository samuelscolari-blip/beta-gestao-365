import {
  BadRequestException,
  ConflictException,
  Injectable,
} from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { AuditService } from "../audit/audit.service";
import { stableJson } from "../common/stable-json";
import { DatabaseService } from "../database/database.service";
import {
  integrationRequests,
  legacyRecords,
} from "../database/schema";
import { EncryptedPayloadService } from "../security/encrypted-payload.service";
import { sha256Hex } from "../security/service-signature";
import type { ErpRequestContext } from "../security/request-context";

type LegacyRecordInput = {
  id?: unknown;
  module?: unknown;
  [key: string]: unknown;
};

@Injectable()
export class MigrationService {
  constructor(
    private readonly database: DatabaseService,
    private readonly encryption: EncryptedPayloadService,
    private readonly audit: AuditService,
  ) {}

  async importD1Records(
    context: ErpRequestContext,
    input: unknown,
  ) {
    if (!Array.isArray(input) || input.length === 0 || input.length > 500) {
      throw new BadRequestException(
        "Envie de 1 a 500 registros por lote de migração.",
      );
    }
    const records = input as LegacyRecordInput[];
    for (const record of records) {
      if (
        !Number.isInteger(Number(record.id)) ||
        !String(record.module || "").trim()
      ) {
        throw new BadRequestException(
          "Cada registro precisa de id e módulo válidos.",
        );
      }
    }

    return this.database.withTenant(context.tenantId, async (tx) => {
      const [request] = await tx
        .insert(integrationRequests)
        .values({
          id: randomUUID(),
          tenantId: context.tenantId,
          requestKey: context.idempotencyKey,
          operation: "D1_RECORD_IMPORT",
        })
        .onConflictDoNothing({
          target: [
            integrationRequests.tenantId,
            integrationRequests.requestKey,
          ],
        })
        .returning();
      if (!request) {
        const [existing] = await tx
          .select()
          .from(integrationRequests)
          .where(
            and(
              eq(integrationRequests.tenantId, context.tenantId),
              eq(
                integrationRequests.requestKey,
                context.idempotencyKey,
              ),
            ),
          )
          .limit(1);
        if (existing?.completed) {
          return {
            ...(existing.response as Record<string, unknown>),
            replayed: true,
          };
        }
        throw new ConflictException(
          "Este lote de migração já está em processamento.",
        );
      }

      let imported = 0;
      for (const record of records) {
        const serialized = stableJson(record);
        const encrypted = this.encryption.encrypt(serialized);
        await tx
          .insert(legacyRecords)
          .values({
            id: randomUUID(),
            tenantId: context.tenantId,
            sourceSystem: "CLOUDFLARE_D1",
            sourceId: String(record.id),
            module: String(record.module),
            payloadCiphertext: encrypted.ciphertext,
            payloadIv: encrypted.iv,
            payloadTag: encrypted.tag,
            payloadHash: sha256Hex(serialized),
          })
          .onConflictDoUpdate({
            target: [
              legacyRecords.tenantId,
              legacyRecords.sourceSystem,
              legacyRecords.sourceId,
            ],
            set: {
              module: String(record.module),
              payloadCiphertext: encrypted.ciphertext,
              payloadIv: encrypted.iv,
              payloadTag: encrypted.tag,
              payloadHash: sha256Hex(serialized),
              migratedAt: new Date(),
            },
          });
        imported += 1;
      }
      await this.audit.append(tx, {
        tenantId: context.tenantId,
        action: "D1_MIGRATION_BATCH_IMPORTED",
        entity: "migration_batch",
        entityId: context.idempotencyKey,
        actor: context.actor,
        metadata: { imported, sourceSystem: "CLOUDFLARE_D1" },
      });
      const response = {
        imported,
        sourceSystem: "CLOUDFLARE_D1",
        replayed: false,
      };
      await tx
        .update(integrationRequests)
        .set({
          completed: true,
          responseCode: 200,
          response,
          completedAt: new Date(),
        })
        .where(eq(integrationRequests.id, request.id));
      return response;
    });
  }
}
