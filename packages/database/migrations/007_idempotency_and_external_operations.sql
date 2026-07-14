SET LOCAL ROLE cumulore_migration;

CREATE OR REPLACE FUNCTION app.complete_job_with_effect(
  p_job uuid,
  p_attempt uuid,
  p_owner text,
  p_generation bigint,
  p_operation text,
  p_destination text,
  p_input_version integer,
  p_configuration_version integer,
  p_safe_result jsonb DEFAULT NULL,
  p_result_reference text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, app
AS $$
DECLARE
  job_row public.jobs%ROWTYPE;
BEGIN
  IF app.current_workspace_id() IS NULL THEN
    RAISE EXCEPTION 'transaction workspace is required' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO job_row FROM public.jobs
  WHERE workspace_id = app.current_workspace_id()
    AND id = p_job AND active_attempt_id = p_attempt AND worker_owner = p_owner
    AND lease_generation = p_generation AND state = 'running'
    AND cancel_requested_at IS NULL AND handler_name = 'run_synthetic'
  FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;

  INSERT INTO public.job_effects (
    workspace_id, job_id, attempt_id, operation, destination, input_version,
    handler_name, handler_version, configuration_version, safe_result, result_reference
  ) VALUES (
    job_row.workspace_id, job_row.id, p_attempt, p_operation, p_destination,
    p_input_version, job_row.handler_name, job_row.handler_version,
    p_configuration_version, p_safe_result, p_result_reference
  ) ON CONFLICT (
    workspace_id, operation, destination, input_version, handler_name,
    handler_version, configuration_version
  ) DO NOTHING;

  UPDATE public.jobs SET state = 'succeeded', terminal_at = clock_timestamp(),
    active_attempt_id = NULL, worker_owner = NULL, lease_expires_at = NULL,
    updated_at = clock_timestamp()
  WHERE workspace_id = job_row.workspace_id AND id = job_row.id;
  UPDATE public.job_attempts SET ended_at = clock_timestamp(), outcome = 'succeeded'
  WHERE workspace_id = job_row.workspace_id AND job_id = job_row.id AND id = p_attempt;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION app.prepare_external_operation(
  p_job uuid,
  p_attempt uuid,
  p_owner text,
  p_generation bigint,
  p_logical_operation_id uuid,
  p_sequence_number integer,
  p_predecessor_id uuid,
  p_predecessor_sequence_number integer,
  p_provider_name text,
  p_operation_name text,
  p_provider_idempotency_key text,
  p_request_hash bytea
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, app
AS $$
DECLARE job_row public.jobs%ROWTYPE; operation_id uuid;
BEGIN
  IF app.current_workspace_id() IS NULL THEN
    RAISE EXCEPTION 'transaction workspace is required' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO job_row FROM public.jobs
  WHERE workspace_id = app.current_workspace_id() AND id = p_job
    AND active_attempt_id = p_attempt AND worker_owner = p_owner
    AND lease_generation = p_generation AND state = 'running'
    AND cancel_requested_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;

  INSERT INTO public.external_operations (
    workspace_id, job_id, attempt_id, logical_operation_id, sequence_number,
    predecessor_id, predecessor_sequence_number, provider_name, operation_name,
    provider_idempotency_key, request_hash
  ) VALUES (
    job_row.workspace_id, job_row.id, p_attempt, p_logical_operation_id,
    p_sequence_number, p_predecessor_id, p_predecessor_sequence_number,
    p_provider_name, p_operation_name, p_provider_idempotency_key, p_request_hash
  ) RETURNING id INTO operation_id;
  RETURN operation_id;
END;
$$;

CREATE OR REPLACE FUNCTION app.mark_external_in_flight(
  p_operation uuid, p_job uuid, p_attempt uuid, p_owner text, p_generation bigint
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, app AS $$
BEGIN
  IF app.current_workspace_id() IS NULL THEN
    RAISE EXCEPTION 'transaction workspace is required' USING ERRCODE = '42501';
  END IF;
  UPDATE public.external_operations AS operation
  SET state = 'in_flight', updated_at = clock_timestamp()
  FROM public.jobs AS job
  WHERE operation.id = p_operation AND operation.workspace_id = app.current_workspace_id()
    AND operation.job_id = p_job AND operation.attempt_id = p_attempt
    AND job.workspace_id = operation.workspace_id AND job.id = p_job
    AND job.active_attempt_id = p_attempt AND job.worker_owner = p_owner
    AND job.lease_generation = p_generation AND job.state = 'running'
    AND operation.state = 'prepared';
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION app.record_external_result(
  p_operation uuid,
  p_job uuid,
  p_attempt uuid,
  p_owner text,
  p_generation bigint,
  p_state public.external_operation_state,
  p_provider_reference text DEFAULT NULL,
  p_error_code text DEFAULT NULL,
  p_next_reconcile_at timestamptz DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, app AS $$
BEGIN
  IF app.current_workspace_id() IS NULL THEN
    RAISE EXCEPTION 'transaction workspace is required' USING ERRCODE = '42501';
  END IF;
  IF p_state NOT IN ('succeeded', 'failed', 'unknown') THEN
    RAISE EXCEPTION 'external result must be succeeded, failed, or unknown'
      USING ERRCODE = '22023';
  END IF;
  IF p_state = 'unknown' AND p_next_reconcile_at IS NULL THEN
    RAISE EXCEPTION 'unknown external results require reconciliation time'
      USING ERRCODE = '22023';
  END IF;
  UPDATE public.external_operations AS operation
  SET state = p_state,
      safe_provider_reference = p_provider_reference,
      safe_error_code = p_error_code,
      next_reconcile_at = CASE WHEN p_state = 'unknown' THEN p_next_reconcile_at ELSE NULL END,
      reconciliation_owner = NULL,
      reconciliation_lease_expires_at = NULL,
      resolved_at = CASE WHEN p_state IN ('succeeded', 'failed') THEN clock_timestamp() ELSE NULL END,
      updated_at = clock_timestamp()
  FROM public.jobs AS job
  WHERE operation.id = p_operation AND operation.workspace_id = app.current_workspace_id()
    AND operation.job_id = p_job AND operation.attempt_id = p_attempt
    AND job.workspace_id = operation.workspace_id AND job.id = p_job
    AND job.active_attempt_id = p_attempt AND job.worker_owner = p_owner
    AND job.lease_generation = p_generation AND job.state = 'running'
    AND operation.state IN ('in_flight', 'prepared');
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION app.link_external_retry(
  p_operation uuid, p_job uuid, p_attempt uuid, p_owner text, p_generation bigint,
  p_request_hash bytea
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, app AS $$
DECLARE source public.external_operations%ROWTYPE; retry_id uuid;
BEGIN
  IF app.current_workspace_id() IS NULL THEN
    RAISE EXCEPTION 'transaction workspace is required' USING ERRCODE = '42501';
  END IF;
  SELECT operation.* INTO source FROM public.external_operations operation
  JOIN public.jobs job ON job.workspace_id = operation.workspace_id AND job.id = p_job
  WHERE operation.id = p_operation AND operation.workspace_id = app.current_workspace_id()
    AND operation.job_id = p_job AND operation.attempt_id = p_attempt
    AND job.active_attempt_id = p_attempt AND job.worker_owner = p_owner
    AND job.lease_generation = p_generation AND job.state = 'running'
    AND operation.state = 'unknown' FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  INSERT INTO public.external_operations (
    workspace_id, job_id, attempt_id, logical_operation_id, sequence_number,
    predecessor_id, predecessor_sequence_number, provider_name, operation_name,
    provider_idempotency_key, request_hash
  ) VALUES (
    source.workspace_id, source.job_id, source.attempt_id, source.logical_operation_id,
    source.sequence_number + 1, source.id, source.sequence_number, source.provider_name,
    source.operation_name, source.provider_idempotency_key, p_request_hash
  ) RETURNING id INTO retry_id;
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
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, app AS $$
BEGIN
  IF app.current_workspace_id() IS NULL THEN
    RAISE EXCEPTION 'transaction workspace is required' USING ERRCODE = '42501';
  END IF;
  IF p_owner IS NULL OR btrim(p_owner) = '' OR char_length(p_owner) > 120
     OR p_batch_size NOT BETWEEN 1 AND 10 OR p_lease_seconds NOT BETWEEN 1 AND 300 THEN
    RAISE EXCEPTION 'invalid reconciliation claim parameters' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
  WITH selected AS MATERIALIZED (
    SELECT operation.id, clock_timestamp() AS claimed_at
    FROM public.external_operations operation
    WHERE operation.workspace_id = app.current_workspace_id()
      AND operation.state = 'unknown'
      AND operation.next_reconcile_at <= clock_timestamp()
      AND (operation.reconciliation_lease_expires_at IS NULL
           OR operation.reconciliation_lease_expires_at <= clock_timestamp())
    ORDER BY operation.next_reconcile_at, operation.id
    FOR UPDATE OF operation SKIP LOCKED LIMIT p_batch_size
  ), claimed AS (
    UPDATE public.external_operations operation
    SET reconciliation_owner = p_owner,
        reconciliation_lease_expires_at = selected.claimed_at + make_interval(secs => p_lease_seconds),
        reconciliation_generation = operation.reconciliation_generation + 1,
        updated_at = selected.claimed_at
    FROM selected WHERE operation.id = selected.id
    RETURNING operation.*
  )
  SELECT claimed.id, claimed.workspace_id, claimed.job_id, claimed.attempt_id,
    claimed.logical_operation_id, claimed.sequence_number, claimed.provider_name,
    claimed.operation_name, claimed.provider_idempotency_key, claimed.request_hash,
    claimed.reconciliation_generation, claimed.reconciliation_lease_expires_at
  FROM claimed ORDER BY claimed.next_reconcile_at, claimed.id;
END;
$$;

CREATE OR REPLACE FUNCTION app.resolve_external_reconciliation(
  p_operation uuid, p_owner text, p_generation bigint, p_success boolean,
  p_provider_reference text DEFAULT NULL, p_error_code text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, app AS $$
BEGIN
  IF app.current_workspace_id() IS NULL THEN
    RAISE EXCEPTION 'transaction workspace is required' USING ERRCODE = '42501';
  END IF;
  UPDATE public.external_operations
  SET state = CASE
    WHEN p_success THEN 'succeeded'::public.external_operation_state
    ELSE 'failed'::public.external_operation_state
  END,
      safe_provider_reference = p_provider_reference,
      safe_error_code = p_error_code,
      reconciliation_owner = NULL,
      reconciliation_lease_expires_at = NULL,
      next_reconcile_at = NULL,
      resolved_at = clock_timestamp(),
      updated_at = clock_timestamp()
  WHERE id = p_operation AND workspace_id = app.current_workspace_id()
    AND state = 'unknown' AND reconciliation_owner = p_owner
    AND reconciliation_generation = p_generation
    AND reconciliation_lease_expires_at > clock_timestamp();
  RETURN FOUND;
END;
$$;

ALTER FUNCTION app.complete_job_with_effect(uuid, uuid, text, bigint, text, text, integer, integer, jsonb, text) OWNER TO cumulore_migration;
ALTER FUNCTION app.prepare_external_operation(uuid, uuid, text, bigint, uuid, integer, uuid, integer, text, text, text, bytea) OWNER TO cumulore_migration;
ALTER FUNCTION app.mark_external_in_flight(uuid, uuid, uuid, text, bigint) OWNER TO cumulore_migration;
ALTER FUNCTION app.record_external_result(uuid, uuid, uuid, text, bigint, public.external_operation_state, text, text, timestamptz) OWNER TO cumulore_migration;
ALTER FUNCTION app.link_external_retry(uuid, uuid, uuid, text, bigint, bytea) OWNER TO cumulore_migration;
ALTER FUNCTION app.claim_external_reconciliation(text, integer, integer) OWNER TO cumulore_migration;
ALTER FUNCTION app.resolve_external_reconciliation(uuid, text, bigint, boolean, text, text) OWNER TO cumulore_migration;

REVOKE ALL ON FUNCTION app.complete_job_with_effect(uuid, uuid, text, bigint, text, text, integer, integer, jsonb, text), app.prepare_external_operation(uuid, uuid, text, bigint, uuid, integer, uuid, integer, text, text, text, bytea), app.mark_external_in_flight(uuid, uuid, uuid, text, bigint), app.record_external_result(uuid, uuid, uuid, text, bigint, public.external_operation_state, text, text, timestamptz), app.link_external_retry(uuid, uuid, uuid, text, bigint, bytea), app.claim_external_reconciliation(text, integer, integer), app.resolve_external_reconciliation(uuid, text, bigint, boolean, text, text) FROM PUBLIC, cumulore_web, cumulore_break_glass;
GRANT EXECUTE ON FUNCTION app.complete_job_with_effect(uuid, uuid, text, bigint, text, text, integer, integer, jsonb, text), app.prepare_external_operation(uuid, uuid, text, bigint, uuid, integer, uuid, integer, text, text, text, bytea), app.mark_external_in_flight(uuid, uuid, uuid, text, bigint), app.record_external_result(uuid, uuid, uuid, text, bigint, public.external_operation_state, text, text, timestamptz), app.link_external_retry(uuid, uuid, uuid, text, bigint, bytea), app.claim_external_reconciliation(text, integer, integer), app.resolve_external_reconciliation(uuid, text, bigint, boolean, text, text) TO cumulore_worker;

GRANT DELETE ON public.endpoint_idempotency_records TO cumulore_web;

RESET ROLE;
