ALTER TABLE payroll_runs
  ADD COLUMN IF NOT EXISTS total_chunks integer NOT NULL DEFAULT 0
  CHECK (total_chunks >= 0);

CREATE UNIQUE INDEX IF NOT EXISTS works_tenant_id_uidx
  ON works (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS employees_tenant_id_uidx
  ON employees (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS payroll_runs_tenant_id_uidx
  ON payroll_runs (tenant_id, id);

CREATE TABLE IF NOT EXISTS payroll_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  payroll_run_id uuid NOT NULL,
  chunk_index integer NOT NULL CHECK (chunk_index >= 0),
  status text NOT NULL DEFAULT 'QUEUED'
    CHECK (status IN ('QUEUED', 'RUNNING', 'RETRYING', 'COMPLETED', 'FAILED')),
  expected_count integer NOT NULL CHECK (expected_count >= 0),
  processed_count integer NOT NULL DEFAULT 0 CHECK (processed_count >= 0),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  totals jsonb NOT NULL DEFAULT '{}'::jsonb,
  result_hash text NOT NULL DEFAULT '',
  failure_code text NOT NULL DEFAULT '',
  failure_message text NOT NULL DEFAULT '',
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payroll_chunks_run_tenant_fk
    FOREIGN KEY (tenant_id, payroll_run_id)
    REFERENCES payroll_runs (tenant_id, id)
    ON DELETE RESTRICT
);
CREATE UNIQUE INDEX IF NOT EXISTS payroll_chunks_run_index_uidx
  ON payroll_chunks (payroll_run_id, chunk_index);
CREATE INDEX IF NOT EXISTS payroll_chunks_tenant_run_status_idx
  ON payroll_chunks (tenant_id, payroll_run_id, status);

CREATE TABLE IF NOT EXISTS payroll_run_inputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  payroll_run_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  work_id uuid,
  chunk_index integer NOT NULL CHECK (chunk_index >= 0),
  input_snapshot jsonb NOT NULL,
  input_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payroll_run_inputs_run_tenant_fk
    FOREIGN KEY (tenant_id, payroll_run_id)
    REFERENCES payroll_runs (tenant_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT payroll_run_inputs_employee_tenant_fk
    FOREIGN KEY (tenant_id, employee_id)
    REFERENCES employees (tenant_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT payroll_run_inputs_work_tenant_fk
    FOREIGN KEY (tenant_id, work_id)
    REFERENCES works (tenant_id, id)
    ON DELETE RESTRICT
);
CREATE UNIQUE INDEX IF NOT EXISTS payroll_run_inputs_run_employee_uidx
  ON payroll_run_inputs (payroll_run_id, employee_id);
CREATE INDEX IF NOT EXISTS payroll_run_inputs_tenant_run_chunk_idx
  ON payroll_run_inputs (tenant_id, payroll_run_id, chunk_index);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'employees_work_tenant_fk'
  ) THEN
    ALTER TABLE employees
      ADD CONSTRAINT employees_work_tenant_fk
      FOREIGN KEY (tenant_id, work_id)
      REFERENCES works (tenant_id, id)
      ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'payroll_runs_work_tenant_fk'
  ) THEN
    ALTER TABLE payroll_runs
      ADD CONSTRAINT payroll_runs_work_tenant_fk
      FOREIGN KEY (tenant_id, work_id)
      REFERENCES works (tenant_id, id)
      ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'payroll_items_run_tenant_fk'
  ) THEN
    ALTER TABLE payroll_items
      ADD CONSTRAINT payroll_items_run_tenant_fk
      FOREIGN KEY (tenant_id, payroll_run_id)
      REFERENCES payroll_runs (tenant_id, id)
      ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'payroll_items_employee_tenant_fk'
  ) THEN
    ALTER TABLE payroll_items
      ADD CONSTRAINT payroll_items_employee_tenant_fk
      FOREIGN KEY (tenant_id, employee_id)
      REFERENCES employees (tenant_id, id)
      ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'payroll_items_work_tenant_fk'
  ) THEN
    ALTER TABLE payroll_items
      ADD CONSTRAINT payroll_items_work_tenant_fk
      FOREIGN KEY (tenant_id, work_id)
      REFERENCES works (tenant_id, id)
      ON DELETE RESTRICT;
  END IF;
END
$$;

ALTER TABLE payroll_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_chunks FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON payroll_chunks;
CREATE POLICY tenant_isolation ON payroll_chunks
  USING (
    tenant_id =
      NULLIF(current_setting('app.tenant_id', true), '')::uuid
  )
  WITH CHECK (
    tenant_id =
      NULLIF(current_setting('app.tenant_id', true), '')::uuid
  );

ALTER TABLE payroll_run_inputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_run_inputs FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON payroll_run_inputs;
CREATE POLICY tenant_isolation ON payroll_run_inputs
  USING (
    tenant_id =
      NULLIF(current_setting('app.tenant_id', true), '')::uuid
  )
  WITH CHECK (
    tenant_id =
      NULLIF(current_setting('app.tenant_id', true), '')::uuid
  );
