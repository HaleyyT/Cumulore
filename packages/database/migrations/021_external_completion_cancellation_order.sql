SET LOCAL ROLE cumulore_migration;

-- Preserve ADR-0003 ordering: only a fenced terminal job success wins a race
-- with cancellation. A provider result remains auditable, but it cannot
-- overtake a cancellation request that committed before job completion.
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
      AND (
        job_row.cancel_requested_at IS NULL
        OR operation.resolved_at <= job_row.cancel_requested_at
      )
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

ALTER FUNCTION app.complete_job_from_external_operation(uuid, uuid, text, bigint, uuid)
  OWNER TO cumulore_migration;

RESET ROLE;
