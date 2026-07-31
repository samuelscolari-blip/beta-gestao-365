import { InjectFlowProducer } from "@nestjs/bullmq";
import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { and, asc, eq } from "drizzle-orm";
import type { FlowProducer } from "bullmq";
import { createHash, randomUUID } from "node:crypto";
import { payrollRules2026 } from "../../../../packages/payroll-core/src/index";
import { AuditService } from "../audit/audit.service";
import { stableJson } from "../common/stable-json";
import { DatabaseService } from "../database/database.service";
import {
  employees,
  payrollChunks,
  payrollRunInputs,
  payrollRuns,
  works,
} from "../database/schema";
import type { ErpRequestContext } from "../security/request-context";
import {
  PAYROLL_FLOW_PRODUCER,
} from "./payroll.constants";
import type { CreatePayrollRunDto } from "./payroll.dto";
import { buildPayrollInputSnapshot } from "./payroll-input";
import {
  buildPayrollFlow,
  chunkItems,
  PAYROLL_INPUT_INSERT_SIZE,
  type PayrollFlowChunk,
} from "./payroll-orchestration";

type QueuedChunk = PayrollFlowChunk;

@Injectable()
export class PayrollService {
  constructor(
    private readonly database: DatabaseService,
    private readonly audit: AuditService,
    @InjectFlowProducer(PAYROLL_FLOW_PRODUCER)
    private readonly flowProducer: FlowProducer,
  ) {}

  async createRun(
    context: ErpRequestContext,
    input: CreatePayrollRunDto,
  ) {
    const runId = randomUUID();
    const result = await this.database.withTenant(
      context.tenantId,
      async (tx) => {
        const [created] = await tx
          .insert(payrollRuns)
          .values({
            id: runId,
            tenantId: context.tenantId,
            requestKey: context.idempotencyKey,
            competence: input.competence,
            workId: input.workId || null,
            rulesVersion: payrollRules2026.version,
            status: "QUEUED",
            requestedBy: context.actor,
          })
          .onConflictDoNothing({
            target: [
              payrollRuns.tenantId,
              payrollRuns.requestKey,
            ],
          })
          .returning();

        if (!created) {
          const [existing] = await tx
            .select()
            .from(payrollRuns)
            .where(
              and(
                eq(payrollRuns.tenantId, context.tenantId),
                eq(payrollRuns.requestKey, context.idempotencyKey),
              ),
            )
            .limit(1);
          if (!existing) {
            return {
              run: null,
              created: false,
              chunks: [] as QueuedChunk[],
            };
          }
          const existingChunks = await tx
            .select({
              id: payrollChunks.id,
              chunkIndex: payrollChunks.chunkIndex,
            })
            .from(payrollChunks)
            .where(
              and(
                eq(payrollChunks.tenantId, context.tenantId),
                eq(payrollChunks.payrollRunId, existing.id),
              ),
            )
            .orderBy(asc(payrollChunks.chunkIndex));
          return {
            run: existing,
            created: false,
            chunks: existingChunks,
          };
        }

        if (input.workId) {
          const [work] = await tx
            .select({ id: works.id })
            .from(works)
            .where(
              and(
                eq(works.tenantId, context.tenantId),
                eq(works.id, input.workId),
              ),
            )
            .limit(1);
          if (!work) {
            throw new NotFoundException(
              "Obra não encontrada para esta empresa.",
            );
          }
        }

        const activeEmployees = await tx
          .select()
          .from(employees)
          .where(
            input.workId
              ? and(
                  eq(employees.tenantId, context.tenantId),
                  eq(employees.status, "ACTIVE"),
                  eq(employees.workId, input.workId),
                )
              : and(
                  eq(employees.tenantId, context.tenantId),
                  eq(employees.status, "ACTIVE"),
                ),
          )
          .orderBy(asc(employees.id));

        const snapshots = activeEmployees.map((employee) => {
          const inputSnapshot = buildPayrollInputSnapshot(
            employee,
            input.competence,
          );
          return {
            employee,
            inputSnapshot,
            inputHash: createHash("sha256")
              .update(stableJson(inputSnapshot))
              .digest("hex"),
          };
        });
        const snapshotChunks = chunkItems(snapshots);
        const queuedChunks: QueuedChunk[] = snapshotChunks.map(
          (_, chunkIndex) => ({
            id: randomUUID(),
            chunkIndex,
          }),
        );

        if (queuedChunks.length) {
          await tx.insert(payrollChunks).values(
            queuedChunks.map((chunk, index) => ({
              id: chunk.id,
              tenantId: context.tenantId,
              payrollRunId: created.id,
              chunkIndex: chunk.chunkIndex,
              status: "QUEUED",
              expectedCount: snapshotChunks[index].length,
            })),
          );
        }

        const inputRecords = snapshotChunks.flatMap(
          (snapshotChunk, chunkIndex) =>
            snapshotChunk.map((snapshot) => ({
              id: randomUUID(),
              tenantId: context.tenantId,
              payrollRunId: created.id,
              employeeId: snapshot.employee.id,
              workId: snapshot.employee.workId,
              chunkIndex,
              inputSnapshot: snapshot.inputSnapshot,
              inputHash: snapshot.inputHash,
            })),
        );
        for (const batch of chunkItems(
          inputRecords,
          PAYROLL_INPUT_INSERT_SIZE,
        )) {
          await tx.insert(payrollRunInputs).values(batch);
        }

        const [prepared] = await tx
          .update(payrollRuns)
          .set({
            employeeCount: snapshots.length,
            totalChunks: queuedChunks.length,
            updatedAt: new Date(),
          })
          .where(eq(payrollRuns.id, created.id))
          .returning();

        await this.audit.append(tx, {
          tenantId: context.tenantId,
          action: "PAYROLL_RUN_QUEUED",
          entity: "payroll_run",
          entityId: created.id,
          actor: context.actor,
          metadata: {
            competence: input.competence,
            workId: input.workId || null,
            rulesVersion: payrollRules2026.version,
            employeeCount: snapshots.length,
            totalChunks: queuedChunks.length,
            frozenInput: true,
          },
        });
        return {
          run: prepared,
          created: true,
          chunks: queuedChunks,
        };
      },
    );

    if (!result.run) {
      throw new ServiceUnavailableException(
        "Não foi possível criar nem recuperar o processamento.",
      );
    }

    if (
      result.created ||
      result.run.status === "QUEUE_UNAVAILABLE"
    ) {
      try {
        await this.dispatchFlow(
          context.tenantId,
          result.run.id,
          result.chunks,
        );
        if (!result.created) {
          await this.database.withTenant(
            context.tenantId,
            async (tx) => {
              await tx
                .update(payrollRuns)
                .set({
                  status: "QUEUED",
                  failureCode: "",
                  failureMessage: "",
                  updatedAt: new Date(),
                })
                .where(eq(payrollRuns.id, result.run!.id));
              await this.audit.append(tx, {
                tenantId: context.tenantId,
                action: "PAYROLL_RUN_REQUEUED",
                entity: "payroll_run",
                entityId: result.run!.id,
                actor: context.actor,
              });
            },
          );
        }
      } catch {
        await this.database.withTenant(
          context.tenantId,
          async (tx) => {
            await tx
              .update(payrollRuns)
              .set({
                status: "QUEUE_UNAVAILABLE",
                failureCode: "QUEUE_UNAVAILABLE",
                failureMessage:
                  "A fila está indisponível; o lote pode ser reenviado com a mesma chave.",
                updatedAt: new Date(),
              })
              .where(eq(payrollRuns.id, result.run!.id));
            await this.audit.append(tx, {
              tenantId: context.tenantId,
              action: "PAYROLL_QUEUE_FAILED",
              entity: "payroll_run",
              entityId: result.run!.id,
              actor: context.actor,
            });
          },
        );
        throw new ServiceUnavailableException(
          "A fila de folha está temporariamente indisponível.",
        );
      }
    }
    return result.run.status === "QUEUE_UNAVAILABLE"
      ? {
          ...result.run,
          status: "QUEUED",
          failureCode: "",
          failureMessage: "",
        }
      : result.run;
  }

  async getRun(context: ErpRequestContext, id: string) {
    const result = await this.database.withTenant(
      context.tenantId,
      async (tx) => {
        const [run] = await tx
          .select()
          .from(payrollRuns)
          .where(
            and(
              eq(payrollRuns.tenantId, context.tenantId),
              eq(payrollRuns.id, id),
            ),
          )
          .limit(1);
        if (!run) return null;
        const chunks = await tx
          .select({
            status: payrollChunks.status,
            expectedCount: payrollChunks.expectedCount,
            processedCount: payrollChunks.processedCount,
          })
          .from(payrollChunks)
          .where(
            and(
              eq(payrollChunks.tenantId, context.tenantId),
              eq(payrollChunks.payrollRunId, id),
            ),
          );
        const byStatus = chunks.reduce<Record<string, number>>(
          (summary, chunk) => {
            summary[chunk.status] = (summary[chunk.status] || 0) + 1;
            return summary;
          },
          {},
        );
        return {
          ...run,
          progress: {
            totalChunks: run.totalChunks,
            queuedChunks: byStatus.QUEUED || 0,
            runningChunks: byStatus.RUNNING || 0,
            retryingChunks: byStatus.RETRYING || 0,
            completedChunks: byStatus.COMPLETED || 0,
            failedChunks: byStatus.FAILED || 0,
            expectedEmployees: chunks.reduce(
              (total, chunk) => total + chunk.expectedCount,
              0,
            ),
            processedEmployees: chunks.reduce(
              (total, chunk) => total + chunk.processedCount,
              0,
            ),
          },
        };
      },
    );
    if (!result) {
      throw new NotFoundException("Lote de folha não encontrado.");
    }
    return result;
  }

  private async dispatchFlow(
    tenantId: string,
    runId: string,
    chunks: QueuedChunk[],
  ) {
    await this.flowProducer.add(
      buildPayrollFlow(tenantId, runId, chunks),
    );
  }
}
