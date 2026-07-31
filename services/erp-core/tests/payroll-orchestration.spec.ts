import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPayrollFlow,
  chunkItems,
  isFinalAttempt,
  payrollBatchJobId,
  payrollFinalizeJobId,
} from "../src/payroll/payroll-orchestration";
import {
  PAYROLL_BATCH_JOB,
  PAYROLL_FINALIZE_JOB,
} from "../src/payroll/payroll.constants";

test("divide uma folha grande em lotes estáveis de 250", () => {
  const employees = Array.from({ length: 5_001 }, (_, index) => index);
  const chunks = chunkItems(employees);

  assert.equal(chunks.length, 21);
  assert.equal(chunks[0].length, 250);
  assert.equal(chunks[19].length, 250);
  assert.equal(chunks[20].length, 1);
  assert.deepEqual(chunks.flat(), employees);
});

test("gera identificadores determinísticos para impedir jobs duplicados", () => {
  const runId = "8b6f6f46-8d0c-4c2b-9db2-325830bd3060";

  assert.equal(
    payrollBatchJobId(runId, 3),
    `payroll-batch-${runId}-3`,
  );
  assert.equal(
    payrollFinalizeJobId(runId),
    `payroll-finalize-${runId}`,
  );
  assert.notEqual(
    payrollBatchJobId(runId, 3),
    payrollBatchJobId(runId, 4),
  );
});

test("monta fluxo pai/filhos com retenção e falha propagada", () => {
  const tenantId = "5f14d10f-4203-4695-ae80-b1dc7a548d3d";
  const runId = "8b6f6f46-8d0c-4c2b-9db2-325830bd3060";
  const flow = buildPayrollFlow(tenantId, runId, [
    { id: "444b1a2d-8e03-47f5-b26f-c2a061546af2", chunkIndex: 0 },
    { id: "cc9914e2-3735-4812-b1cb-94d8b64ab6b6", chunkIndex: 1 },
  ]);

  assert.equal(flow.name, PAYROLL_FINALIZE_JOB);
  assert.equal(flow.opts?.jobId, payrollFinalizeJobId(runId));
  assert.equal(flow.children?.length, 2);
  assert.equal(flow.children?.[0].name, PAYROLL_BATCH_JOB);
  assert.equal(flow.children?.[0].opts?.attempts, 5);
  assert.equal(
    flow.children?.[0].opts?.failParentOnFailure,
    true,
  );
  assert.deepEqual(flow.children?.[0].opts?.removeOnComplete, {
    age: 86_400,
    count: 10_000,
  });
});

test("só encerra como falha na última tentativa configurada", () => {
  assert.equal(
    isFinalAttempt({ attemptsMade: 0, opts: { attempts: 5 } }),
    false,
  );
  assert.equal(
    isFinalAttempt({ attemptsMade: 4, opts: { attempts: 5 } }),
    true,
  );
  assert.equal(
    isFinalAttempt({ attemptsMade: 0, opts: {} }),
    true,
  );
});

test("rejeita tamanho de lote inválido", () => {
  assert.throws(() => chunkItems([1, 2], 0));
  assert.throws(() => chunkItems([1, 2], 1.5));
});
