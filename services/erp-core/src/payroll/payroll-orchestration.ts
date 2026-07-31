import type { FlowJob } from "bullmq";
import {
  PAYROLL_BATCH_JOB,
  PAYROLL_FINALIZE_JOB,
  PAYROLL_QUEUE,
} from "./payroll.constants";

export const PAYROLL_CHUNK_SIZE = 250;
export const PAYROLL_INPUT_INSERT_SIZE = 500;

export type PayrollFlowChunk = {
  id: string;
  chunkIndex: number;
};

export function chunkItems<T>(
  items: readonly T[],
  size = PAYROLL_CHUNK_SIZE,
): T[][] {
  if (!Number.isInteger(size) || size <= 0) {
    throw new Error("O tamanho do lote deve ser um inteiro positivo.");
  }
  const chunks: T[][] = [];
  for (let start = 0; start < items.length; start += size) {
    chunks.push(items.slice(start, start + size));
  }
  return chunks;
}

export function payrollBatchJobId(runId: string, chunkIndex: number) {
  return `payroll-batch-${runId}-${chunkIndex}`;
}

export function payrollFinalizeJobId(runId: string) {
  return `payroll-finalize-${runId}`;
}

export function buildPayrollFlow(
  tenantId: string,
  runId: string,
  chunks: PayrollFlowChunk[],
): FlowJob {
  const children = chunks.map((chunk) => ({
    name: PAYROLL_BATCH_JOB,
    queueName: PAYROLL_QUEUE,
    data: {
      tenantId,
      runId,
      chunkId: chunk.id,
    },
    opts: {
      jobId: payrollBatchJobId(runId, chunk.chunkIndex),
      attempts: 5,
      backoff: { type: "exponential" as const, delay: 2_000 },
      failParentOnFailure: true,
      removeOnComplete: { age: 86_400, count: 10_000 },
      removeOnFail: { age: 604_800, count: 20_000 },
    },
  }));

  return {
    name: PAYROLL_FINALIZE_JOB,
    queueName: PAYROLL_QUEUE,
    data: { tenantId, runId },
    opts: {
      jobId: payrollFinalizeJobId(runId),
      attempts: 3,
      backoff: { type: "exponential", delay: 2_000 },
      removeOnComplete: { age: 86_400, count: 5_000 },
      removeOnFail: { age: 604_800, count: 10_000 },
    },
    ...(children.length ? { children } : {}),
  };
}

export function isFinalAttempt(job: {
  attemptsMade: number;
  opts: { attempts?: number };
}) {
  const configuredAttempts = Number(job.opts.attempts || 1);
  return job.attemptsMade + 1 >= configuredAttempts;
}
