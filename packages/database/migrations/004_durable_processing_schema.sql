SET LOCAL ROLE cumulore_migration;

CREATE TYPE synthetic_operation_scenario AS ENUM (
  'database_effect',
  'external_success',
  'unknown_then_success',
  'retryable_failure',
  'non_retryable_failure',
  'cooperative_wait'
);
CREATE TYPE event_scope AS ENUM ('workspace', 'account', 'global');
CREATE TYPE event_actor_type AS ENUM ('user', 'system', 'worker');
CREATE TYPE endpoint_idempotency_status AS ENUM ('processing', 'completed');
CREATE TYPE durable_job_state AS ENUM (
  'pending',
  'running',
  'retry_wait',
  'succeeded',
  'dead_letter',
  'cancelled'
);
CREATE TYPE job_attempt_outcome AS ENUM (
  'succeeded',
  'retryable_failure',
  'non_retryable_failure',
  'abandoned',
  'cancelled'
);
CREATE TYPE job_retry_classification AS ENUM ('retryable', 'non_retryable');
CREATE TYPE job_action_type AS ENUM ('cancellation_requested', 'cancelled', 'manual_retry');
CREATE TYPE external_operation_state AS ENUM (
  'prepared',
  'in_flight',
  'succeeded',
  'failed',
  'unknown'
);

CREATE TABLE synthetic_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  requested_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  scenario synthetic_operation_scenario NOT NULL,
  input_version integer NOT NULL CHECK (input_version > 0),
  configuration_version integer NOT NULL CHECK (configuration_version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, id)
);

CREATE TABLE outbox_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope event_scope NOT NULL,
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  schema_version integer NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  actor_type event_actor_type NOT NULL,
  actor_id text,
  correlation_id uuid NOT NULL,
  causation_id uuid,
  payload jsonb NOT NULL,
  dispatch_completed_at timestamptz,
  dispatched_handler_count integer NOT NULL DEFAULT 0,
  CONSTRAINT outbox_scope_workspace_check CHECK (
    (scope = 'workspace' AND workspace_id IS NOT NULL)
    OR (scope IN ('account', 'global') AND workspace_id IS NULL)
  ),
  CONSTRAINT outbox_actor_check CHECK (
    (actor_type IN ('user', 'worker') AND actor_id IS NOT NULL AND char_length(actor_id) BETWEEN 1 AND 120)
    OR (actor_type = 'system' AND actor_id IS NULL)
  ),
  CONSTRAINT outbox_event_type_check CHECK (
    event_type ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$'
    AND char_length(event_type) <= 160
  ),
  CONSTRAINT outbox_schema_version_check CHECK (schema_version > 0),
  CONSTRAINT outbox_payload_object_check CHECK (jsonb_typeof(payload) = 'object'),
  CONSTRAINT outbox_dispatch_check CHECK (
    dispatched_handler_count >= 0
    AND (dispatch_completed_at IS NOT NULL OR dispatched_handler_count = 0)
  ),
  UNIQUE NULLS NOT DISTINCT (workspace_id, id, event_type, schema_version)
);

CREATE INDEX outbox_events_undispatched_idx
  ON outbox_events (occurred_at, id)
  WHERE dispatch_completed_at IS NULL;
CREATE INDEX outbox_events_dispatched_cleanup_idx
  ON outbox_events (dispatch_completed_at, id)
  WHERE dispatch_completed_at IS NOT NULL;
CREATE INDEX outbox_events_workspace_idx ON outbox_events (workspace_id, occurred_at, id);
CREATE INDEX outbox_events_correlation_idx ON outbox_events (correlation_id, occurred_at, id);

CREATE TABLE event_handlers (
  event_type text NOT NULL,
  schema_version integer NOT NULL,
  handler_name text NOT NULL,
  handler_version integer NOT NULL,
  requires_workspace boolean NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  deactivated_at timestamptz,
  PRIMARY KEY (event_type, schema_version, handler_name, handler_version),
  CONSTRAINT event_handlers_event_type_check CHECK (
    event_type ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$'
    AND char_length(event_type) <= 160
  ),
  CONSTRAINT event_handlers_schema_version_check CHECK (schema_version > 0),
  CONSTRAINT event_handlers_handler_name_check CHECK (
    handler_name ~ '^[a-z][a-z0-9_]*$' AND char_length(handler_name) <= 120
  ),
  CONSTRAINT event_handlers_handler_version_check CHECK (handler_version > 0),
  CONSTRAINT event_handlers_activation_check CHECK (
    (active AND deactivated_at IS NULL) OR (NOT active AND deactivated_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX event_handlers_one_active_version_idx
  ON event_handlers (event_type, schema_version, handler_name)
  WHERE active;

INSERT INTO event_handlers (
  event_type,
  schema_version,
  handler_name,
  handler_version,
  requires_workspace
) VALUES ('durable.synthetic.requested', 1, 'run_synthetic', 1, true);

CREATE TABLE endpoint_idempotency_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  actor_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  operation text NOT NULL,
  idempotency_key text NOT NULL,
  request_hash bytea NOT NULL,
  status endpoint_idempotency_status NOT NULL DEFAULT 'processing',
  response_status integer,
  response_body jsonb,
  response_reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  CONSTRAINT endpoint_idempotency_operation_check CHECK (
    operation ~ '^[a-z][a-z0-9_.:-]*$' AND char_length(operation) <= 160
  ),
  CONSTRAINT endpoint_idempotency_key_check CHECK (char_length(idempotency_key) BETWEEN 1 AND 200),
  CONSTRAINT endpoint_idempotency_hash_check CHECK (octet_length(request_hash) = 32),
  CONSTRAINT endpoint_idempotency_expiry_check CHECK (expires_at > created_at),
  CONSTRAINT endpoint_idempotency_response_check CHECK (
    (status = 'processing' AND response_status IS NULL AND response_body IS NULL AND response_reference IS NULL)
    OR (
      status = 'completed'
      AND response_status BETWEEN 100 AND 599
      AND ((response_body IS NOT NULL)::integer + (response_reference IS NOT NULL)::integer = 1)
      AND (response_body IS NULL OR (jsonb_typeof(response_body) = 'object' AND octet_length(response_body::text) <= 16384))
      AND (response_reference IS NULL OR char_length(response_reference) BETWEEN 1 AND 500)
    )
  ),
  UNIQUE NULLS NOT DISTINCT (workspace_id, actor_user_id, operation, idempotency_key)
);

CREATE INDEX endpoint_idempotency_expiry_idx
  ON endpoint_idempotency_records (expires_at, id)
  WHERE status = 'completed';

CREATE TABLE jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  event_id uuid NOT NULL,
  event_type text NOT NULL,
  event_schema_version integer NOT NULL,
  handler_name text NOT NULL,
  handler_version integer NOT NULL,
  state durable_job_state NOT NULL DEFAULT 'pending',
  available_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  terminal_at timestamptz,
  retry_generation integer NOT NULL DEFAULT 0,
  generation_attempt_count integer NOT NULL DEFAULT 0,
  lifetime_attempt_count integer NOT NULL DEFAULT 0,
  lease_generation bigint NOT NULL DEFAULT 0,
  active_attempt_id uuid,
  worker_owner text,
  lease_expires_at timestamptz,
  cancel_requested_at timestamptz,
  last_error_code text,
  UNIQUE (workspace_id, id),
  UNIQUE (id, workspace_id),
  UNIQUE (event_id, handler_name, handler_version),
  FOREIGN KEY (workspace_id, event_id, event_type, event_schema_version)
    REFERENCES outbox_events (workspace_id, id, event_type, schema_version) ON DELETE RESTRICT,
  FOREIGN KEY (event_type, event_schema_version, handler_name, handler_version)
    REFERENCES event_handlers (event_type, schema_version, handler_name, handler_version) ON DELETE RESTRICT,
  CONSTRAINT jobs_attempt_budget_check CHECK (
    retry_generation >= 0
    AND generation_attempt_count BETWEEN 0 AND 5
    AND lifetime_attempt_count BETWEEN 0 AND 10
    AND generation_attempt_count <= lifetime_attempt_count
    AND lease_generation >= 0
  ),
  CONSTRAINT jobs_running_lease_check CHECK (
    (
      state = 'running'
      AND active_attempt_id IS NOT NULL
      AND worker_owner IS NOT NULL
      AND char_length(worker_owner) BETWEEN 1 AND 120
      AND lease_expires_at IS NOT NULL
    )
    OR (
      state <> 'running'
      AND active_attempt_id IS NULL
      AND worker_owner IS NULL
      AND lease_expires_at IS NULL
    )
  ),
  CONSTRAINT jobs_terminal_check CHECK (
    (state IN ('succeeded', 'dead_letter', 'cancelled') AND terminal_at IS NOT NULL)
    OR (state NOT IN ('succeeded', 'dead_letter', 'cancelled') AND terminal_at IS NULL)
  ),
  CONSTRAINT jobs_error_code_check CHECK (
    last_error_code IS NULL
    OR (last_error_code ~ '^[a-z0-9_.-]+$' AND char_length(last_error_code) <= 120)
  )
);

CREATE INDEX jobs_claim_idx
  ON jobs (available_at, created_at, id)
  WHERE state IN ('pending', 'retry_wait');
CREATE INDEX jobs_expired_lease_idx
  ON jobs (lease_expires_at, id)
  WHERE state = 'running';
CREATE INDEX jobs_terminal_cleanup_idx
  ON jobs (terminal_at, id)
  WHERE state IN ('succeeded', 'cancelled');
CREATE INDEX jobs_dead_letter_idx
  ON jobs (terminal_at, id)
  WHERE state = 'dead_letter';
CREATE INDEX jobs_nonterminal_handler_idx
  ON jobs (handler_name, handler_version, created_at, id)
  WHERE state IN ('pending', 'running', 'retry_wait');

CREATE TABLE job_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  job_id uuid NOT NULL,
  retry_generation integer NOT NULL,
  generation_attempt_number integer NOT NULL,
  lifetime_attempt_number integer NOT NULL,
  lease_generation bigint NOT NULL,
  worker_owner text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  outcome job_attempt_outcome,
  retry_classification job_retry_classification,
  safe_error_code text,
  safe_usage_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (workspace_id, id),
  UNIQUE (workspace_id, job_id, id),
  UNIQUE (job_id, lease_generation),
  UNIQUE (job_id, retry_generation, generation_attempt_number),
  UNIQUE (job_id, lifetime_attempt_number),
  FOREIGN KEY (workspace_id, job_id) REFERENCES jobs (workspace_id, id) ON DELETE RESTRICT,
  CONSTRAINT job_attempts_numbers_check CHECK (
    retry_generation >= 0
    AND generation_attempt_number BETWEEN 1 AND 5
    AND lifetime_attempt_number BETWEEN 1 AND 10
    AND lease_generation > 0
  ),
  CONSTRAINT job_attempts_worker_owner_check CHECK (char_length(worker_owner) BETWEEN 1 AND 120),
  CONSTRAINT job_attempts_usage_object_check CHECK (jsonb_typeof(safe_usage_metadata) = 'object'),
  CONSTRAINT job_attempts_error_code_check CHECK (
    safe_error_code IS NULL
    OR (safe_error_code ~ '^[a-z0-9_.-]+$' AND char_length(safe_error_code) <= 120)
  ),
  CONSTRAINT job_attempts_closure_check CHECK (
    (outcome IS NULL AND ended_at IS NULL AND retry_classification IS NULL AND safe_error_code IS NULL)
    OR (outcome IN ('succeeded', 'cancelled') AND ended_at IS NOT NULL AND retry_classification IS NULL)
    OR (outcome IN ('retryable_failure', 'abandoned') AND ended_at IS NOT NULL AND retry_classification = 'retryable')
    OR (outcome = 'non_retryable_failure' AND ended_at IS NOT NULL AND retry_classification = 'non_retryable')
  )
);

ALTER TABLE jobs
  ADD CONSTRAINT jobs_active_attempt_fk
  FOREIGN KEY (workspace_id, id, active_attempt_id)
  REFERENCES job_attempts (workspace_id, job_id, id)
  DEFERRABLE INITIALLY DEFERRED;

CREATE OR REPLACE FUNCTION app.guard_job_attempt_history() RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'job attempt history cannot be deleted';
  END IF;

  IF OLD.ended_at IS NOT NULL OR OLD.outcome IS NOT NULL THEN
    RAISE EXCEPTION 'closed job attempt history is immutable';
  END IF;

  IF NEW.ended_at IS NULL OR NEW.outcome IS NULL THEN
    RAISE EXCEPTION 'an open job attempt may only be updated once to close it';
  END IF;

  IF (
    to_jsonb(OLD) - ARRAY['ended_at', 'outcome', 'retry_classification', 'safe_error_code', 'safe_usage_metadata']
  ) IS DISTINCT FROM (
    to_jsonb(NEW) - ARRAY['ended_at', 'outcome', 'retry_classification', 'safe_error_code', 'safe_usage_metadata']
  ) THEN
    RAISE EXCEPTION 'job attempt identity and lease fields are immutable';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER job_attempt_history_guard
BEFORE UPDATE OR DELETE ON job_attempts
FOR EACH ROW EXECUTE FUNCTION app.guard_job_attempt_history();

CREATE TABLE job_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  job_id uuid NOT NULL,
  action job_action_type NOT NULL,
  actor_type event_actor_type NOT NULL,
  actor_id text,
  reason text,
  previous_state durable_job_state NOT NULL,
  next_state durable_job_state NOT NULL,
  retry_generation integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, id),
  FOREIGN KEY (workspace_id, job_id) REFERENCES jobs (workspace_id, id) ON DELETE RESTRICT,
  CONSTRAINT job_actions_actor_check CHECK (
    (actor_type IN ('user', 'worker') AND actor_id IS NOT NULL AND char_length(actor_id) BETWEEN 1 AND 120)
    OR (actor_type = 'system' AND actor_id IS NULL)
  ),
  CONSTRAINT job_actions_reason_check CHECK (reason IS NULL OR char_length(reason) BETWEEN 1 AND 500),
  CONSTRAINT job_actions_retry_generation_check CHECK (retry_generation >= 0),
  CONSTRAINT job_actions_state_change_check CHECK (previous_state <> next_state)
);

CREATE UNIQUE INDEX job_actions_manual_retry_generation_idx
  ON job_actions (job_id, retry_generation)
  WHERE action = 'manual_retry';

CREATE TABLE job_effects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  job_id uuid NOT NULL,
  attempt_id uuid NOT NULL,
  operation text NOT NULL,
  destination text NOT NULL,
  input_version integer NOT NULL,
  handler_name text NOT NULL,
  handler_version integer NOT NULL,
  configuration_version integer NOT NULL,
  safe_result jsonb,
  result_reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, id),
  FOREIGN KEY (workspace_id, job_id, attempt_id)
    REFERENCES job_attempts (workspace_id, job_id, id) ON DELETE RESTRICT,
  CONSTRAINT job_effects_operation_check CHECK (
    operation ~ '^[a-z][a-z0-9_.:-]*$' AND char_length(operation) <= 160
  ),
  CONSTRAINT job_effects_destination_check CHECK (char_length(destination) BETWEEN 1 AND 500),
  CONSTRAINT job_effects_versions_check CHECK (
    input_version > 0 AND handler_version > 0 AND configuration_version > 0
  ),
  CONSTRAINT job_effects_handler_name_check CHECK (
    handler_name ~ '^[a-z][a-z0-9_]*$' AND char_length(handler_name) <= 120
  ),
  CONSTRAINT job_effects_result_check CHECK (
    (safe_result IS NOT NULL)::integer + (result_reference IS NOT NULL)::integer <= 1
    AND (safe_result IS NULL OR (jsonb_typeof(safe_result) = 'object' AND octet_length(safe_result::text) <= 16384))
    AND (result_reference IS NULL OR char_length(result_reference) BETWEEN 1 AND 500)
  ),
  UNIQUE (
    workspace_id,
    operation,
    destination,
    input_version,
    handler_name,
    handler_version,
    configuration_version
  )
);

CREATE TABLE external_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  job_id uuid NOT NULL,
  attempt_id uuid NOT NULL,
  logical_operation_id uuid NOT NULL,
  sequence_number integer NOT NULL,
  predecessor_id uuid,
  predecessor_sequence_number integer,
  provider_name text NOT NULL,
  operation_name text NOT NULL,
  provider_idempotency_key text NOT NULL,
  request_hash bytea NOT NULL,
  state external_operation_state NOT NULL DEFAULT 'prepared',
  safe_provider_reference text,
  safe_error_code text,
  reconciliation_owner text,
  reconciliation_lease_expires_at timestamptz,
  reconciliation_generation bigint NOT NULL DEFAULT 0,
  next_reconcile_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  UNIQUE (workspace_id, id),
  CONSTRAINT external_operations_logical_sequence_uniq
    UNIQUE (workspace_id, logical_operation_id, sequence_number),
  CONSTRAINT external_operations_predecessor_target_uniq
    UNIQUE (workspace_id, logical_operation_id, sequence_number, id),
  FOREIGN KEY (workspace_id, job_id, attempt_id)
    REFERENCES job_attempts (workspace_id, job_id, id) ON DELETE RESTRICT,
  CONSTRAINT external_operations_predecessor_fk FOREIGN KEY (
    workspace_id,
    logical_operation_id,
    predecessor_sequence_number,
    predecessor_id
  ) REFERENCES external_operations (
    workspace_id,
    logical_operation_id,
    sequence_number,
    id
  ) ON DELETE RESTRICT,
  CONSTRAINT external_operations_sequence_check CHECK (
    (sequence_number = 0 AND predecessor_id IS NULL AND predecessor_sequence_number IS NULL)
    OR (
      sequence_number > 0
      AND predecessor_id IS NOT NULL
      AND predecessor_sequence_number = sequence_number - 1
    )
  ),
  CONSTRAINT external_operations_provider_check CHECK (
    provider_name ~ '^[a-z][a-z0-9_.-]*$'
    AND operation_name ~ '^[a-z][a-z0-9_.-]*$'
    AND char_length(provider_name) <= 120
    AND char_length(operation_name) <= 120
  ),
  CONSTRAINT external_operations_key_check CHECK (char_length(provider_idempotency_key) BETWEEN 1 AND 300),
  CONSTRAINT external_operations_hash_check CHECK (octet_length(request_hash) = 32),
  CONSTRAINT external_operations_reference_check CHECK (
    safe_provider_reference IS NULL OR char_length(safe_provider_reference) BETWEEN 1 AND 500
  ),
  CONSTRAINT external_operations_error_check CHECK (
    safe_error_code IS NULL
    OR (safe_error_code ~ '^[a-z0-9_.-]+$' AND char_length(safe_error_code) <= 120)
  ),
  CONSTRAINT external_operations_reconciliation_check CHECK (
    reconciliation_generation >= 0
    AND (
      (reconciliation_owner IS NULL AND reconciliation_lease_expires_at IS NULL)
      OR (
        state = 'unknown'
        AND reconciliation_owner IS NOT NULL
        AND char_length(reconciliation_owner) BETWEEN 1 AND 120
        AND reconciliation_lease_expires_at IS NOT NULL
      )
    )
  ),
  CONSTRAINT external_operations_state_check CHECK (
    (state IN ('prepared', 'in_flight') AND resolved_at IS NULL AND next_reconcile_at IS NULL)
    OR (state = 'unknown' AND resolved_at IS NULL AND next_reconcile_at IS NOT NULL)
    OR (
      state IN ('succeeded', 'failed')
      AND resolved_at IS NOT NULL
      AND next_reconcile_at IS NULL
      AND reconciliation_owner IS NULL
      AND reconciliation_lease_expires_at IS NULL
    )
  )
);

CREATE INDEX external_operations_due_reconciliation_idx
  ON external_operations (next_reconcile_at, id)
  WHERE state = 'unknown';
CREATE INDEX external_operations_job_history_idx
  ON external_operations (workspace_id, job_id, created_at, id);
CREATE INDEX external_operations_retention_idx
  ON external_operations (resolved_at, id)
  WHERE state IN ('succeeded', 'failed');

ALTER TABLE synthetic_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE synthetic_operations FORCE ROW LEVEL SECURITY;
ALTER TABLE outbox_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbox_events FORCE ROW LEVEL SECURITY;
ALTER TABLE endpoint_idempotency_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE endpoint_idempotency_records FORCE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs FORCE ROW LEVEL SECURITY;
ALTER TABLE job_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_attempts FORCE ROW LEVEL SECURITY;
ALTER TABLE job_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_actions FORCE ROW LEVEL SECURITY;
ALTER TABLE job_effects ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_effects FORCE ROW LEVEL SECURITY;
ALTER TABLE external_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_operations FORCE ROW LEVEL SECURITY;

CREATE POLICY synthetic_operations_web_select ON synthetic_operations FOR SELECT TO cumulore_web
  USING (workspace_id = app.current_workspace_id() AND app.active_workspace_member(workspace_id));
CREATE POLICY synthetic_operations_web_insert ON synthetic_operations FOR INSERT TO cumulore_web
  WITH CHECK (
    workspace_id = app.current_workspace_id()
    AND requested_by_user_id = app.current_user_id()
    AND app.active_workspace_member(workspace_id)
  );
CREATE POLICY synthetic_operations_worker_select ON synthetic_operations FOR SELECT TO cumulore_worker
  USING (workspace_id = app.current_workspace_id());
CREATE POLICY synthetic_operations_migration ON synthetic_operations FOR ALL TO cumulore_migration
  USING (true) WITH CHECK (true);

CREATE POLICY outbox_events_web_select ON outbox_events FOR SELECT TO cumulore_web
  USING (
    scope = 'workspace'
    AND workspace_id = app.current_workspace_id()
    AND app.active_workspace_member(workspace_id)
  );
CREATE POLICY outbox_events_web_insert ON outbox_events FOR INSERT TO cumulore_web
  WITH CHECK (
    scope = 'workspace'
    AND workspace_id = app.current_workspace_id()
    AND actor_type = 'user'
    AND actor_id = app.current_user_id()::text
    AND app.active_workspace_member(workspace_id)
  );
CREATE POLICY outbox_events_worker_select ON outbox_events FOR SELECT TO cumulore_worker
  USING (scope = 'workspace' AND workspace_id = app.current_workspace_id());
CREATE POLICY outbox_events_migration ON outbox_events FOR ALL TO cumulore_migration
  USING (true) WITH CHECK (true);

CREATE POLICY endpoint_idempotency_web ON endpoint_idempotency_records FOR ALL TO cumulore_web
  USING (
    actor_user_id = app.current_user_id()
    AND (
      (workspace_id IS NULL AND app.current_workspace_id() IS NULL)
      OR (workspace_id = app.current_workspace_id() AND app.active_workspace_member(workspace_id))
    )
  )
  WITH CHECK (
    actor_user_id = app.current_user_id()
    AND (
      (workspace_id IS NULL AND app.current_workspace_id() IS NULL)
      OR (workspace_id = app.current_workspace_id() AND app.active_workspace_member(workspace_id))
    )
  );
CREATE POLICY endpoint_idempotency_migration ON endpoint_idempotency_records FOR ALL TO cumulore_migration
  USING (true) WITH CHECK (true);

CREATE POLICY jobs_web_select ON jobs FOR SELECT TO cumulore_web
  USING (workspace_id = app.current_workspace_id() AND app.active_workspace_member(workspace_id));
CREATE POLICY jobs_worker_select ON jobs FOR SELECT TO cumulore_worker
  USING (workspace_id = app.current_workspace_id());
CREATE POLICY jobs_migration ON jobs FOR ALL TO cumulore_migration USING (true) WITH CHECK (true);

CREATE POLICY job_attempts_web_select ON job_attempts FOR SELECT TO cumulore_web
  USING (workspace_id = app.current_workspace_id() AND app.active_workspace_member(workspace_id));
CREATE POLICY job_attempts_worker_select ON job_attempts FOR SELECT TO cumulore_worker
  USING (workspace_id = app.current_workspace_id());
CREATE POLICY job_attempts_migration ON job_attempts FOR ALL TO cumulore_migration
  USING (true) WITH CHECK (true);

CREATE POLICY job_actions_web_select ON job_actions FOR SELECT TO cumulore_web
  USING (workspace_id = app.current_workspace_id() AND app.active_workspace_member(workspace_id));
CREATE POLICY job_actions_worker_select ON job_actions FOR SELECT TO cumulore_worker
  USING (workspace_id = app.current_workspace_id());
CREATE POLICY job_actions_migration ON job_actions FOR ALL TO cumulore_migration
  USING (true) WITH CHECK (true);

CREATE POLICY job_effects_web_select ON job_effects FOR SELECT TO cumulore_web
  USING (workspace_id = app.current_workspace_id() AND app.active_workspace_member(workspace_id));
CREATE POLICY job_effects_worker_select ON job_effects FOR SELECT TO cumulore_worker
  USING (workspace_id = app.current_workspace_id());
CREATE POLICY job_effects_migration ON job_effects FOR ALL TO cumulore_migration
  USING (true) WITH CHECK (true);

CREATE POLICY external_operations_web_select ON external_operations FOR SELECT TO cumulore_web
  USING (workspace_id = app.current_workspace_id() AND app.active_workspace_member(workspace_id));
CREATE POLICY external_operations_worker_select ON external_operations FOR SELECT TO cumulore_worker
  USING (workspace_id = app.current_workspace_id());
CREATE POLICY external_operations_migration ON external_operations FOR ALL TO cumulore_migration
  USING (true) WITH CHECK (true);

GRANT USAGE ON SCHEMA app TO cumulore_worker;
GRANT SELECT, INSERT ON synthetic_operations, outbox_events TO cumulore_web;
GRANT SELECT, INSERT, UPDATE ON endpoint_idempotency_records TO cumulore_web;
GRANT SELECT ON jobs, job_attempts, job_actions, job_effects, external_operations TO cumulore_web;
GRANT SELECT ON synthetic_operations, outbox_events, event_handlers, jobs, job_attempts, job_actions, job_effects, external_operations TO cumulore_worker;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON event_handlers FROM cumulore_web, cumulore_worker;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON jobs, job_attempts, job_actions, job_effects, external_operations FROM cumulore_web, cumulore_worker;
REVOKE ALL ON FUNCTION app.guard_job_attempt_history() FROM PUBLIC;

RESET ROLE;
