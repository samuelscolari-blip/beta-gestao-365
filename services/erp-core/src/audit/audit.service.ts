import { Injectable } from "@nestjs/common";
import { asc, desc, eq, sql } from "drizzle-orm";
import { createHash, randomUUID } from "node:crypto";
import type { TenantTransaction } from "../database/database.service";
import { auditEvents } from "../database/schema";
import { stableJson } from "../common/stable-json";

type AuditInput = {
  tenantId: string;
  action: string;
  entity: string;
  entityId: string;
  actor: string;
  metadata?: Record<string, unknown>;
};

@Injectable()
export class AuditService {
  async append(
    tx: TenantTransaction,
    input: AuditInput,
  ) {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${input.tenantId}, 0))`,
    );
    const [previous] = await tx
      .select({
        sequence: auditEvents.sequence,
        entryHash: auditEvents.entryHash,
      })
      .from(auditEvents)
      .where(eq(auditEvents.tenantId, input.tenantId))
      .orderBy(desc(auditEvents.sequence))
      .limit(1);
    const sequence = (previous?.sequence || 0) + 1;
    const previousHash = previous?.entryHash || "GENESIS";
    const createdAt = new Date();
    const metadata = input.metadata || {};
    const entryHash = createHash("sha256")
      .update(
        stableJson({
          tenantId: input.tenantId,
          sequence,
          action: input.action,
          entity: input.entity,
          entityId: input.entityId,
          actor: input.actor,
          metadata,
          previousHash,
          createdAt: createdAt.toISOString(),
        }),
      )
      .digest("hex");

    await tx.insert(auditEvents).values({
      id: randomUUID(),
      tenantId: input.tenantId,
      sequence,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      actor: input.actor,
      metadata,
      previousHash,
      entryHash,
      createdAt,
    });
    return { sequence, entryHash };
  }

  async verify(
    tx: TenantTransaction,
    tenantId: string,
  ) {
    const events = await tx
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.tenantId, tenantId))
      .orderBy(asc(auditEvents.sequence));
    let previousHash = "GENESIS";
    for (const event of events) {
      const expected = createHash("sha256")
        .update(
          stableJson({
            tenantId: event.tenantId,
            sequence: event.sequence,
            action: event.action,
            entity: event.entity,
            entityId: event.entityId,
            actor: event.actor,
            metadata: event.metadata,
            previousHash,
            createdAt: event.createdAt.toISOString(),
          }),
        )
        .digest("hex");
      if (
        event.previousHash !== previousHash ||
        event.entryHash !== expected
      ) {
        return {
          valid: false,
          sequence: event.sequence,
          checked: events.length,
        };
      }
      previousHash = event.entryHash;
    }
    return { valid: true, checked: events.length, lastHash: previousHash };
  }
}
