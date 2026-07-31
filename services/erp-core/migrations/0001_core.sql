CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS tenants (
  id uuid PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  legal_name text NOT NULL,
  trade_name text NOT NULL DEFAULT '',
  cnpj text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS works (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  name text NOT NULL,
  cno text NOT NULL DEFAULT '',
  cost_center text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'ACTIVE',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS works_tenant_status_idx
  ON works (tenant_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS works_tenant_cno_uidx
  ON works (tenant_id, cno) WHERE cno <> '';

CREATE TABLE IF NOT EXISTS employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  work_id uuid REFERENCES works(id),
  employee_code text NOT NULL,
  name text NOT NULL,
  role text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'ACTIVE',
  base_salary numeric(15, 2) NOT NULL CHECK (base_salary >= 0),
  monthly_hours numeric(8, 2) NOT NULL DEFAULT 220 CHECK (monthly_hours > 0),
  payroll_profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  sensitive_payload_ciphertext text NOT NULL DEFAULT '',
  sensitive_payload_iv text NOT NULL DEFAULT '',
  sensitive_payload_tag text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS employees_tenant_code_uidx
  ON employees (tenant_id, employee_code);
CREATE INDEX IF NOT EXISTS employees_tenant_status_idx
  ON employees (tenant_id, status);
CREATE INDEX IF NOT EXISTS employees_tenant_work_idx
  ON employees (tenant_id, work_id);

CREATE TABLE IF NOT EXISTS rule_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  code text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  domain text NOT NULL,
  status text NOT NULL DEFAULT 'DRAFT',
  effective_from timestamptz NOT NULL,
  effective_until timestamptz,
  scope jsonb NOT NULL DEFAULT '{}'::jsonb,
  definition jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_url text NOT NULL DEFAULT '',
  approved_by text NOT NULL DEFAULT '',
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (effective_until IS NULL OR effective_until >= effective_from)
);
CREATE UNIQUE INDEX IF NOT EXISTS rule_versions_tenant_code_version_uidx
  ON rule_versions (tenant_id, code, version);
CREATE INDEX IF NOT EXISTS rule_versions_tenant_domain_idx
  ON rule_versions (tenant_id, domain, status);

CREATE TABLE IF NOT EXISTS payroll_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  request_key text NOT NULL,
  competence text NOT NULL CHECK (competence ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  work_id uuid REFERENCES works(id),
  rules_version text NOT NULL,
  status text NOT NULL DEFAULT 'QUEUED',
  employee_count integer NOT NULL DEFAULT 0,
  totals jsonb NOT NULL DEFAULT '{}'::jsonb,
  result_hash text NOT NULL DEFAULT '',
  requested_by text NOT NULL,
  started_at timestamptz,
  completed_at timestamptz,
  failure_code text NOT NULL DEFAULT '',
  failure_message text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS payroll_runs_tenant_request_uidx
  ON payroll_runs (tenant_id, request_key);
CREATE INDEX IF NOT EXISTS payroll_runs_tenant_competence_idx
  ON payroll_runs (tenant_id, competence, status);

CREATE TABLE IF NOT EXISTS payroll_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  payroll_run_id uuid NOT NULL REFERENCES payroll_runs(id),
  employee_id uuid NOT NULL REFERENCES employees(id),
  work_id uuid REFERENCES works(id),
  gross numeric(15, 2) NOT NULL,
  deductions numeric(15, 2) NOT NULL,
  net numeric(15, 2) NOT NULL,
  employer_cost numeric(15, 2) NOT NULL,
  calculation jsonb NOT NULL,
  calculation_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS payroll_items_run_employee_uidx
  ON payroll_items (payroll_run_id, employee_id);
CREATE INDEX IF NOT EXISTS payroll_items_tenant_run_idx
  ON payroll_items (tenant_id, payroll_run_id);

CREATE TABLE IF NOT EXISTS fiscal_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  request_key text NOT NULL,
  system text NOT NULL,
  event_code text NOT NULL,
  layout_version text NOT NULL,
  environment text NOT NULL DEFAULT 'RESTRICTED',
  status text NOT NULL DEFAULT 'DRAFT',
  xml_ciphertext text NOT NULL DEFAULT '',
  xml_iv text NOT NULL DEFAULT '',
  xml_tag text NOT NULL DEFAULT '',
  xml_hash text NOT NULL DEFAULT '',
  signed_xml_ciphertext text NOT NULL DEFAULT '',
  signed_xml_iv text NOT NULL DEFAULT '',
  signed_xml_tag text NOT NULL DEFAULT '',
  signed_xml_hash text NOT NULL DEFAULT '',
  protocol text NOT NULL DEFAULT '',
  receipt text NOT NULL DEFAULT '',
  requested_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS fiscal_events_tenant_request_uidx
  ON fiscal_events (tenant_id, request_key);
CREATE INDEX IF NOT EXISTS fiscal_events_tenant_status_idx
  ON fiscal_events (tenant_id, system, status);

CREATE TABLE IF NOT EXISTS legacy_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  source_system text NOT NULL,
  source_id text NOT NULL,
  module text NOT NULL,
  payload_ciphertext text NOT NULL,
  payload_iv text NOT NULL,
  payload_tag text NOT NULL,
  payload_hash text NOT NULL,
  migrated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS legacy_records_tenant_source_uidx
  ON legacy_records (tenant_id, source_system, source_id);
CREATE INDEX IF NOT EXISTS legacy_records_tenant_module_idx
  ON legacy_records (tenant_id, module);

CREATE TABLE IF NOT EXISTS audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  sequence integer NOT NULL,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id text NOT NULL,
  actor text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  previous_hash text NOT NULL,
  entry_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS audit_events_tenant_sequence_uidx
  ON audit_events (tenant_id, sequence);
CREATE UNIQUE INDEX IF NOT EXISTS audit_events_tenant_hash_uidx
  ON audit_events (tenant_id, entry_hash);
CREATE INDEX IF NOT EXISTS audit_events_tenant_entity_idx
  ON audit_events (tenant_id, entity, entity_id);

CREATE TABLE IF NOT EXISTS integration_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  request_key text NOT NULL,
  operation text NOT NULL,
  response_code integer NOT NULL DEFAULT 0,
  completed boolean NOT NULL DEFAULT false,
  response jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS integration_requests_tenant_request_uidx
  ON integration_requests (tenant_id, request_key);

CREATE OR REPLACE FUNCTION reject_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_events is append-only';
END;
$$;

DROP TRIGGER IF EXISTS audit_events_no_update ON audit_events;
CREATE TRIGGER audit_events_no_update
BEFORE UPDATE ON audit_events
FOR EACH ROW EXECUTE FUNCTION reject_audit_mutation();

DROP TRIGGER IF EXISTS audit_events_no_delete ON audit_events;
CREATE TRIGGER audit_events_no_delete
BEFORE DELETE ON audit_events
FOR EACH ROW EXECUTE FUNCTION reject_audit_mutation();

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'tenants',
    'works',
    'employees',
    'rule_versions',
    'payroll_runs',
    'payroll_items',
    'fiscal_events',
    'legacy_records',
    'audit_events',
    'integration_requests'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', table_name);
    IF table_name = 'tenants' THEN
      EXECUTE format(
        'CREATE POLICY tenant_isolation ON %I USING (id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid) WITH CHECK (id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid)',
        table_name
      );
    ELSE
      EXECUTE format(
        'CREATE POLICY tenant_isolation ON %I USING (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid) WITH CHECK (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid)',
        table_name
      );
    END IF;
  END LOOP;
END
$$;

-- ID estável para mapear o tenant atual do portal durante a migração.
SELECT set_config('app.tenant_id', '8b6f6f46-8d0c-4c2b-9db2-325830bd3060', false);
INSERT INTO tenants (
  id,
  slug,
  legal_name,
  trade_name,
  status
) VALUES (
  '8b6f6f46-8d0c-4c2b-9db2-325830bd3060',
  'beta-construtora',
  'Beta Construtora',
  'Beta Construtora',
  'ACTIVE'
) ON CONFLICT (id) DO NOTHING;
SELECT set_config('app.tenant_id', '', false);
