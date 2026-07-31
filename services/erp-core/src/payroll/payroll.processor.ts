import { Processor, WorkerHost } from "@nestjs/bullmq";
import { and, asc, eq, sql } from "drizzle-orm";
import type { Job } from "bullmq";
import { createHash, randomUUID } from "node:crypto";
import {
  calculatePayroll,
  normalizePayrollInput,
  validatePayrollInput,
  type PayrollInput,
  type PayrollResult,
} from "../../../../packages/payroll-core/src/index";
import { AuditService } from "../audit/audit.service";
import { stableJson } from "../common/stable-json";
import { loadConfig } from "../config/env";
import { DatabaseService } from "../database/database.service";
import {
  payrollChunks,
  payrollItems,
  payrollRunInputs,
  payrollRuns,
} from "../database/schema";
import {
  PAYROLL_BATCH_JOB,
  PAYROLL_FINALIZE_JOB,
  PAYROLL_QUEUE,
} from "./payroll.constants";
import { isFinalAttempt } from "./payroll-orchestration";

type PayrollBatchJob = {
  tenantId: string;
  runId: string;
  chunkId: string;
};

type PayrollFinalizeJob = {
  tenantId: string;
  runId: string;
};

type Totals = {
  gross: number;
  deductions: number;
  net: number;
  fgts: number;
  employerCharges: number;
  employerCost: number;
};

const emptyTotals = (): Totals => ({
  gross: 0,
  deductions: 0,
  net: 0,
  fgts: 0,
  employerCharges: 0,
  employerCost: 0,
});

const money = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;

@Processor(PAYROLL_QUEUE, {
  concurrency: loadConfig().payrollWorkerConcurrency,
})
export class PayrollProcessor extends WorkerHost {
  constructor(
    private readonly database: DatabaseService,
    private readonly audit: AuditService,
  ) {
    super();
  }

  override async process(
    job: Job<PayrollBatchJob | PayrollFinalizeJob>,
  ) {
    if (job.name === PAYROLL_BATCH_JOB) {
      return this.processBatch(job as Job<PayrollBatchJob>);
    }
    if (job.name === PAYROLL_FINALIZE_JOB) {
      return this.finalizeRun(job as Job<PayrollFinalizeJob>);
    }
    throw new Error(`Tipo de trabalho de folha desconhecido: ${job.name}.`);
  }

  private async processBatch(job: Job<PayrollBatchJob>) {
    const { tenantId, runId, chunkId } = job.data;
    try {
      const initial = await this.database.withTenant(
        tenantId,
        async (tx) => {
          const [run] = await tx
            .select()
            .from(payrollRuns)
            .where(
              and(
                eq(payrollRuns.tenantId, tenantId),
                eq(payrollRuns.id, runId),
              ),
            )
            .limit(1);
          const [chunk] = await tx
            .select()
            .from(payrollChunks)
            .where(
              and(
                eq(payrollChunks.tenantId, tenantId),
                eq(payrollChunks.id, chunkId),
                eq(payrollChunks.payrollRunId, runId),
              ),
            )
            .limit(1);
          if (!run || !chunk) {
            throw new Error("Execução ou lote de folha não encontrado.");
          }
          if (chunk.status === "COMPLETED") {
            return {
              completed: true as const,
              chunk,
              inputs: [],
            };
          }
          if (run.status === "COMPLETED") {
            throw new Error(
              "A execução já foi finalizada, mas o lote está inconsistente.",
            );
          }

          await tx
            .update(payrollRuns)
            .set({
              status: "RUNNING",
              startedAt: run.startedAt || new Date(),
              failureCode: "",
              failureMessage: "",
              updatedAt: new Date(),
            })
            .where(eq(payrollRuns.id, runId));
          await tx
            .update(payrollChunks)
            .set({
              status: "RUNNING",
              attempts: job.attemptsMade + 1,
              startedAt: chunk.startedAt || new Date(),
              failureCode: "",
              failureMessage: "",
              updatedAt: new Date(),
            })
            .where(eq(payrollChunks.id, chunkId));

          const inputs = await tx
            .select()
            .from(payrollRunInputs)
            .where(
              and(
                eq(payrollRunInputs.tenantId, tenantId),
                eq(payrollRunInputs.payrollRunId, runId),
                eq(
                  payrollRunInputs.chunkIndex,
                  chunk.chunkIndex,
                ),
              ),
            )
            .orderBy(asc(payrollRunInputs.employeeId));
          if (inputs.length !== chunk.expectedCount) {
            throw new Error(
              "A quantidade de entradas congeladas diverge do lote.",
            );
          }
          return {
            completed: false as const,
            chunk,
            inputs,
          };
        },
      );

      if (initial.completed) {
        return {
          runId,
          chunkId,
          status: "COMPLETED",
          processedCount: initial.chunk.processedCount,
          resultHash: initial.chunk.resultHash,
        };
      }

      const totals = emptyTotals();
      const resultHashes: string[] = [];
      const calculatedItems = initial.inputs.map((snapshot) => {
        const input = normalizePayrollInput(
          snapshot.inputSnapshot as Partial<PayrollInput>,
        );
        const validationErrors = validatePayrollInput(input);
        if (validationErrors.length) {
          throw new Error(
            `Entrada congelada inválida: ${validationErrors.join(" ")}`,
          );
        }
        const result: PayrollResult = calculatePayroll(input);
        const calculationHash = createHash("sha256")
          .update(
            stableJson({
              inputHash: snapshot.inputHash,
              result,
            }),
          )
          .digest("hex");
        resultHashes.push(calculationHash);
        totals.gross = money(totals.gross + result.gross);
        totals.deductions = money(
          totals.deductions + result.totalDeductions,
        );
        totals.net = money(totals.net + result.net);
        totals.fgts = money(totals.fgts + result.fgts);
        totals.employerCharges = money(
          totals.employerCharges + result.employerCharges,
        );
        totals.employerCost = money(
          totals.employerCost + result.totalEmployerCost,
        );
        return {
          id: randomUUID(),
          tenantId,
          payrollRunId: runId,
          employeeId: snapshot.employeeId,
          workId: snapshot.workId,
          gross: result.gross.toFixed(2),
          deductions: result.totalDeductions.toFixed(2),
          net: result.net.toFixed(2),
          employerCost: result.totalEmployerCost.toFixed(2),
          calculation: result,
          calculationHash,
        };
      });
      const resultHash = createHash("sha256")
        .update(
          stableJson({
            tenantId,
            runId,
            chunkIndex: initial.chunk.chunkIndex,
            inputHashes: initial.inputs.map(
              (snapshot) => snapshot.inputHash,
            ),
            resultHashes,
            totals,
          }),
        )
        .digest("hex");

      await this.database.withTenant(tenantId, async (tx) => {
        if (calculatedItems.length) {
          await tx
            .insert(payrollItems)
            .values(calculatedItems)
            .onConflictDoUpdate({
              target: [
                payrollItems.payrollRunId,
                payrollItems.employeeId,
              ],
              set: {
                workId: sql`excluded.work_id`,
                gross: sql`excluded.gross`,
                deductions: sql`excluded.deductions`,
                net: sql`excluded.net`,
                employerCost: sql`excluded.employer_cost`,
                calculation: sql`excluded.calculation`,
                calculationHash: sql`excluded.calculation_hash`,
              },
            });
        }
        await tx
          .update(payrollChunks)
          .set({
            status: "COMPLETED",
            processedCount: calculatedItems.length,
            totals,
            resultHash,
            failureCode: "",
            failureMessage: "",
            completedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(payrollChunks.id, chunkId));
        await this.audit.append(tx, {
          tenantId,
          action: "PAYROLL_CHUNK_COMPLETED",
          entity: "payroll_chunk",
          entityId: chunkId,
          actor: "worker:payroll",
          metadata: {
            runId,
            chunkIndex: initial.chunk.chunkIndex,
            processedCount: calculatedItems.length,
            resultHash,
          },
        });
      });

      await job.updateProgress({
        processed: calculatedItems.length,
        total: initial.chunk.expectedCount,
      });
      return {
        runId,
        chunkId,
        status: "COMPLETED",
        processedCount: calculatedItems.length,
        resultHash,
      };
    } catch (error) {
      await this.recordBatchFailure(job, error);
      throw error;
    }
  }

  private async finalizeRun(job: Job<PayrollFinalizeJob>) {
    const { tenantId, runId } = job.data;
    try {
      return await this.database.withTenant(
        tenantId,
        async (tx) => {
          const [run] = await tx
            .select()
            .from(payrollRuns)
            .where(
              and(
                eq(payrollRuns.tenantId, tenantId),
                eq(payrollRuns.id, runId),
              ),
            )
            .limit(1);
          if (!run) throw new Error("Execução de folha não encontrada.");
          if (run.status === "COMPLETED") {
            return {
              runId,
              status: run.status,
              employeeCount: run.employeeCount,
              resultHash: run.resultHash,
            };
          }

          const chunks = await tx
            .select()
            .from(payrollChunks)
            .where(
              and(
                eq(payrollChunks.tenantId, tenantId),
                eq(payrollChunks.payrollRunId, runId),
              ),
            )
            .orderBy(asc(payrollChunks.chunkIndex));
          if (
            chunks.length !== run.totalChunks ||
            chunks.some((chunk) => chunk.status !== "COMPLETED")
          ) {
            throw new Error(
              "A execução não pode ser fechada antes de todos os lotes.",
            );
          }

          const items = await tx
            .select()
            .from(payrollItems)
            .where(
              and(
                eq(payrollItems.tenantId, tenantId),
                eq(payrollItems.payrollRunId, runId),
              ),
            )
            .orderBy(asc(payrollItems.employeeId));
          if (items.length !== run.employeeCount) {
            throw new Error(
              "A quantidade de resultados diverge do quadro congelado.",
            );
          }

          const totals = items.reduce<Totals>((summary, item) => {
            const calculation =
              item.calculation as Partial<PayrollResult>;
            summary.gross = money(
              summary.gross + Number(item.gross),
            );
            summary.deductions = money(
              summary.deductions + Number(item.deductions),
            );
            summary.net = money(summary.net + Number(item.net));
            summary.fgts = money(
              summary.fgts + Number(calculation.fgts || 0),
            );
            summary.employerCharges = money(
              summary.employerCharges +
                Number(calculation.employerCharges || 0),
            );
            summary.employerCost = money(
              summary.employerCost + Number(item.employerCost),
            );
            return summary;
          }, emptyTotals());
          const resultHash = createHash("sha256")
            .update(
              stableJson({
                tenantId,
                runId,
                rulesVersion: run.rulesVersion,
                chunkHashes: chunks.map(
                  (chunk) => chunk.resultHash,
                ),
                calculationHashes: items.map(
                  (item) => item.calculationHash,
                ),
                totals,
              }),
            )
            .digest("hex");

          await tx
            .update(payrollRuns)
            .set({
              status: "COMPLETED",
              totals,
              resultHash,
              failureCode: "",
              failureMessage: "",
              completedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(payrollRuns.id, runId));
          await this.audit.append(tx, {
            tenantId,
            action: "PAYROLL_RUN_COMPLETED",
            entity: "payroll_run",
            entityId: runId,
            actor: "worker:payroll",
            metadata: {
              employeeCount: run.employeeCount,
              totalChunks: run.totalChunks,
              rulesVersion: run.rulesVersion,
              resultHash,
            },
          });
          return {
            runId,
            status: "COMPLETED",
            employeeCount: run.employeeCount,
            totalChunks: run.totalChunks,
            resultHash,
          };
        },
      );
    } catch (error) {
      await this.recordFinalizerFailure(job, error);
      throw error;
    }
  }

  private async recordBatchFailure(
    job: Job<PayrollBatchJob>,
    error: unknown,
  ) {
    const { tenantId, runId, chunkId } = job.data;
    const finalAttempt = isFinalAttempt(job);
    await this.database
      .withTenant(tenantId, async (tx) => {
        const [chunk] = await tx
          .select({ status: payrollChunks.status })
          .from(payrollChunks)
          .where(
            and(
              eq(payrollChunks.tenantId, tenantId),
              eq(payrollChunks.id, chunkId),
            ),
          )
          .limit(1);
        if (!chunk || chunk.status === "COMPLETED") return;

        await tx
          .update(payrollChunks)
          .set({
            status: finalAttempt ? "FAILED" : "RETRYING",
            attempts: job.attemptsMade + 1,
            failureCode: "PAYROLL_CHUNK_ERROR",
            failureMessage: finalAttempt
              ? "Falha definitiva no processamento do lote."
              : "Falha transitória; uma nova tentativa foi programada.",
            updatedAt: new Date(),
          })
          .where(eq(payrollChunks.id, chunkId));
        if (finalAttempt) {
          await tx
            .update(payrollRuns)
            .set({
              status: "FAILED",
              failureCode: "PAYROLL_CHUNK_ERROR",
              failureMessage:
                "Um dos lotes não pôde ser processado após as tentativas configuradas.",
              updatedAt: new Date(),
            })
            .where(eq(payrollRuns.id, runId));
        }
        await this.audit.append(tx, {
          tenantId,
          action: finalAttempt
            ? "PAYROLL_CHUNK_FAILED"
            : "PAYROLL_CHUNK_RETRY_SCHEDULED",
          entity: "payroll_chunk",
          entityId: chunkId,
          actor: "worker:payroll",
          metadata: {
            runId,
            attempt: job.attemptsMade + 1,
            errorType:
              error instanceof Error
                ? error.constructor.name
                : "UnknownError",
          },
        });
      })
      .catch(() => undefined);
  }

  private async recordFinalizerFailure(
    job: Job<PayrollFinalizeJob>,
    error: unknown,
  ) {
    const { tenantId, runId } = job.data;
    const finalAttempt = isFinalAttempt(job);
    await this.database
      .withTenant(tenantId, async (tx) => {
        await tx
          .update(payrollRuns)
          .set({
            status: finalAttempt ? "FAILED" : "RUNNING",
            failureCode: "PAYROLL_FINALIZER_ERROR",
            failureMessage: finalAttempt
              ? "Não foi possível consolidar os lotes da folha."
              : "A consolidação será tentada novamente.",
            updatedAt: new Date(),
          })
          .where(eq(payrollRuns.id, runId));
        await this.audit.append(tx, {
          tenantId,
          action: finalAttempt
            ? "PAYROLL_RUN_FAILED"
            : "PAYROLL_FINALIZER_RETRY_SCHEDULED",
          entity: "payroll_run",
          entityId: runId,
          actor: "worker:payroll",
          metadata: {
            attempt: job.attemptsMade + 1,
            errorType:
              error instanceof Error
                ? error.constructor.name
                : "UnknownError",
          },
        });
      })
      .catch(() => undefined);
  }
}
