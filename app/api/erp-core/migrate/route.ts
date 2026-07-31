import { createHash } from "node:crypto";
import { DEMO_SOURCE } from "../../../../db/demo-records";
import { listRecords } from "../../../../db/records";
import {
  actorFrom,
  requireSoleAdmin,
} from "../../../lib/server-access";
import { erpCoreRequest } from "../../../lib/erp-core-client";

export async function POST(request: Request) {
  const denied = requireSoleAdmin(request);
  if (denied) return denied;

  try {
    const records = (await listRecords())
      .filter(
        (record) =>
          record.source !== DEMO_SOURCE &&
          record.module !== "settings",
      )
      .map((record) => ({
        id: record.id,
        module: record.module,
        title: record.title,
        reference: record.reference,
        status: record.status,
        recordDate: record.recordDate,
        amount: record.amount,
        payload: record.payload,
        source: record.source,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      }));
    if (!records.length) {
      return Response.json({
        success: true,
        imported: 0,
        batches: 0,
        message:
          "Nenhum registro operacional foi encontrado. Os dados fictícios não são migrados.",
      });
    }

    let imported = 0;
    let batches = 0;
    for (let start = 0; start < records.length; start += 500) {
      const batch = records.slice(start, start + 500);
      const digest = createHash("sha256")
        .update(
          batch
            .map((record) => `${record.id}:${record.updatedAt}`)
            .join("|"),
        )
        .digest("hex")
        .slice(0, 32);
      const result = await erpCoreRequest<{
        imported?: number;
      }>("/v1/migrations/d1-records", {
        method: "POST",
        actor: actorFrom(request),
        idempotencyKey: `d1-migration-${digest}`,
        body: { records: batch },
        timeoutMs: 30_000,
      });
      imported += Number(result.imported || 0);
      batches += 1;
    }
    return Response.json({
      success: true,
      imported,
      batches,
      message:
        `${imported} registro(s) operacional(is) foram copiados para o núcleo ERP. O D1 continua ativo até a homologação do corte.`,
    });
  } catch (error) {
    return Response.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível executar a migração.",
      },
      { status: 503 },
    );
  }
}
