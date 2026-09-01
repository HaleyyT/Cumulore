SET LOCAL ROLE cumulore_migration;

CREATE OR REPLACE FUNCTION app.complete_job_from_external_operation(
  p_job uuid,
  p_attempt uuid,
  p_owner text,
  p_generation bigint,
  p_logical_operation_id uuid
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, app
AS $$
DECLARE job_row public.jobs%ROWTYPE;
BEGIN
  IF app.current_workspace_id() IS NULL THEN
    RAISE EXCEPTION 'transaction workspace is required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO job_row
  FROM public.jobs
  WHERE workspace_id = app.current_workspace_id()
    AND id = p_job
    AND active_attempt_id = p_attempt
    AND worker_owner = p_owner
    AND lease_generation = p_generation
    AND state = 'running'
    AND handler_name = 'run_synthetic'
  FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.external_operations operation
    JOIN public.outbox_events event
      ON event.workspace_id = operation.workspace_id AND event.id = job_row.event_id
    WHERE operation.workspace_id = job_row.workspace_id
      AND operation.job_id = job_row.id
      AND operation.logical_operation_id = p_logical_operation_id
      AND operation.provider_name = 'fake'
      AND operation.operation_name = 'invoke'
      AND operation.state = 'succeeded'
      AND event.event_type = 'durable.synthetic.requested'
      AND event.schema_version = 1
      AND event.payload->>'synthetic_operation_id' = p_logical_operation_id::text
  ) THEN
    RETURN false;
  END IF;

  UPDATE public.job_attempts
  SET ended_at = clock_timestamp(), outcome = 'succeeded'
  WHERE workspace_id = job_row.workspace_id
    AND job_id = job_row.id
    AND id = p_attempt;

  UPDATE public.jobs
  SET state = 'succeeded',
      terminal_at = clock_timestamp(),
      active_attempt_id = NULL,
      worker_owner = NULL,
      lease_expires_at = NULL,
      updated_at = clock_timestamp()
  WHERE workspace_id = job_row.workspace_id AND id = job_row.id;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION app.recover_stale_external_operations(
  p_batch_size integer DEFAULT 50
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, app
AS $$
DECLARE recovered integer;
BEGIN
  IF p_batch_size IS NULL OR p_batch_size NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'external recovery batch size must be between 1 and 100'
      USING ERRCODE = '22023';
  END IF;

  WITH candidates AS MATERIALIZED (
    SELECT operation.id, operation.state
    FROM public.external_operations operation
    JOIN public.jobs job
      ON job.workspace_id = operation.workspace_id AND job.id = operation.job_id
    WHERE operation.state IN ('prepared', 'in_flight')
      AND NOT (
        job.state = 'running'
        AND job.active_attempt_id = operation.attempt_id
        AND job.lease_expires_at > clock_timestamp()
      )
    ORDER BY operation.updated_at, operation.id
    LIMIT p_batch_size
    FOR UPDATE OF operation SKIP LOCKED
  ), recovered_rows AS (
    UPDATE public.external_operations operation
    SET state = CASE
          WHEN candidates.state = 'prepared'
            THEN 'failed'::public.external_operation_state
          ELSE 'unknown'::public.external_operation_state
        END,
        safe_error_code = CASE
          WHEN candidates.state = 'prepared' THEN 'invocation_not_started'
          ELSE 'invocation_outcome_unknown'
        END,
        reconciliation_owner = NULL,
        reconciliation_lease_expires_at = NULL,
        next_reconcile_at = CASE
          WHEN candidates.state = 'in_flight' THEN clock_timestamp()
          ELSE NULL
        END,
        resolved_at = CASE
          WHEN candidates.state = 'prepared' THEN clock_timestamp()
          ELSE NULL
        END,
        updated_at = clock_timestamp()
    FROM candidates
    WHERE operation.id = candidates.id
    RETURNING operation.id
  )
  SELECT count(*) INTO recovered FROM recovered_rows;

  RETURN recovered;
END;
$$;

CREATE OR REPLACE FUNCTION app.link_external_retry(
  p_operation uuid,
  p_job uuid,
  p_attempt uuid,
  p_owner text,
  p_generation bigint,
  p_request_hash bytea
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, app
AS $$
DECLARE
  source public.external_operations%ROWTYPE;
  retry_id uuid;
BEGIN
  IF app.current_workspace_id() IS NULL THEN
    RAISE EXCEPTION 'transaction workspace is required' USING ERRCODE = '42501';
  END IF;

  SELECT operation.* INTO source
  FROM public.external_operations operation
  JOIN public.jobs job
    ON job.workspace_id = operation.workspace_id AND job.id = operation.job_id
  WHERE operation.id = p_operation
    AND operation.workspace_id = app.current_workspace_id()
    AND operation.job_id = p_job
    AND operation.state = 'failed'
    AND job.active_attempt_id = p_attempt
    AND job.worker_owner = p_owner
    AND job.lease_generation = p_generation
    AND job.state = 'running'
    AND job.cancel_requested_at IS NULL
  FOR UPDATE OF operation, job;
  IF NOT FOUND THEN RETURN NULL; END IF;

  IF source.request_hash <> p_request_hash THEN
    RAISE EXCEPTION 'external retry request does not match the original request'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.external_operations (
    workspace_id, job_id, attempt_id, logical_operation_id, sequence_number,
    predecessor_id, predecessor_sequence_number, provider_name, operation_name,
    provider_idempotency_key, request_hash
  ) VALUES (
    source.workspace_id, source.job_id, p_attempt, source.logical_operation_id,
    source.sequence_number + 1, source.id, source.sequence_number,
    source.provider_name, source.operation_name, source.provider_idempotency_key,
    source.request_hash
  )
  ON CONFLICT (workspace_id, logical_operation_id, sequence_number) DO NOTHING
  RETURNING id INTO retry_id;

  IF retry_id IS NULL THEN
    SELECT operation.id INTO retry_id
    FROM public.external_operations operation
    WHERE operation.workspace_id = source.workspace_id
      AND operation.logical_operation_id = source.logical_operation_id
      AND operation.sequence_number = source.sequence_number + 1
      AND operation.predecessor_id = source.id
      AND operation.attempt_id = p_attempt
      AND operation.provider_idempotency_key = source.provider_idempotency_key
      AND operation.request_hash = source.request_hash;
  END IF;

  RETURN retry_id;
END;
$$;

CREATE OR REPLACE FUNCTION app.claim_external_reconciliation(
  p_owner text, p_batch_size integer DEFAULT 1, p_lease_seconds integer DEFAULT 60
) RETURNS TABLE (
  operation_id uuid, workspace_id uuid, job_id uuid, attempt_id uuid,
  logical_operation_id uuid, sequence_number integer, provider_name text,
  operation_name text, provider_idempotency_key text, request_hash bytea,
  reconciliation_generation bigint, reconciliation_lease_expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, app
AS $$
BEGIN
  IF p_owner IS NULL OR btrim(p_owner) = '' OR char_length(p_owner) > 120
     OR p_batch_size NOT BETWEEN 1 AND 10 OR p_lease_seconds NOT BETWEEN 1 AND 300 THEN
    RAISE EXCEPTION 'invalid reconciliation claim parameters' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  WITH selected AS MATERIALIZED (
    SELECT operation.id, clock_timestamp() AS claimed_at
    FROM public.external_operations operation
    WHERE operation.state = 'unknown'
      AND operation.next_reconcile_at <= clock_timestamp()
      AND (
        operation.reconciliation_lease_expires_at IS NULL
        OR operation.reconciliation_lease_expires_at <= clock_timestamp()
      )
    ORDER BY operation.next_reconcile_at, operation.id
    FOR UPDATE OF operation SKIP LOCKED
    LIMIT p_batch_size
  ), claimed AS (
    UPDATE public.external_operations operation
    SET reconciliation_owner = p_owner,
        reconciliation_lease_expires_at = selected.claimed_at + make_interval(secs => p_lease_seconds),
        reconciliation_generation = operation.reconciliation_generation + 1,
        updated_at = selected.claimed_at
    FROM selected
    WHERE operation.id = selected.id
    RETURNING operation.*
  )
  SELECT claimed.id, claimed.workspace_id, claimed.job_id, claimed.attempt_id,
    claimed.logical_operation_id, claimed.sequence_number, claimed.provider_name,
    claimed.operation_name, claimed.provider_idempotency_key, claimed.request_hash,
    claimed.reconciliation_generation, claimed.reconciliation_lease_expires_at
  FROM claimed
  ORDER BY claimed.next_reconcile_at, claimed.id;
END;
$$;

ALTER FUNCTION app.complete_job_from_external_operation(uuid, uuid, text, bigint, uuid)
  OWNER TO cumulore_migration;
ALTER FUNCTION app.recover_stale_external_operations(integer)
  OWNER TO cumulore_migration;
ALTER FUNCTION app.link_external_retry(uuid, uuid, uuid, text, bigint, bytea)
  OWNER TO cumulore_migration;
ALTER FUNCTION app.claim_external_reconciliation(text, integer, integer)
  OWNER TO cumulore_migration;

REVOKE ALL ON FUNCTION
  app.complete_job_from_external_operation(uuid, uuid, text, bigint, uuid),
  app.recover_stale_external_operations(integer),
  app.link_external_retry(uuid, uuid, uuid, text, bigint, bytea),
  app.claim_external_reconciliation(text, integer, integer)
FROM PUBLIC, cumulore_web, cumulore_break_glass;

GRANT EXECUTE ON FUNCTION
  app.complete_job_from_external_operation(uuid, uuid, text, bigint, uuid),
  app.recover_stale_external_operations(integer),
  app.link_external_retry(uuid, uuid, uuid, text, bigint, bytea),
  app.claim_external_reconciliation(text, integer, integer)
TO cumulore_worker;

RESET ROLE;
