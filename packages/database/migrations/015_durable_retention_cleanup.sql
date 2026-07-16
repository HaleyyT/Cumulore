SET LOCAL ROLE cumulore_migration;

CREATE OR REPLACE FUNCTION app.guard_job_attempt_history() RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, app
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF current_user = 'cumulore_migration'
      AND current_setting('app.retention_cleanup', true) = 'on' THEN
      RETURN OLD;
    END IF;
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

CREATE OR REPLACE FUNCTION app.cleanup_durable_processing(p_batch_size integer DEFAULT 100)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, app AS $$
DECLARE deleted_count integer := 0; removed integer;
BEGIN
  IF p_batch_size IS NULL OR p_batch_size NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'cleanup batch size must be between 1 and 100' USING ERRCODE = '22023';
  END IF;

  WITH candidates AS (
    SELECT id FROM public.endpoint_idempotency_records
    WHERE status = 'completed' AND expires_at <= clock_timestamp()
    ORDER BY expires_at, id LIMIT p_batch_size FOR UPDATE SKIP LOCKED
  ) DELETE FROM public.endpoint_idempotency_records record USING candidates
    WHERE record.id = candidates.id;
  GET DIAGNOSTICS removed = ROW_COUNT;
  deleted_count := deleted_count + removed;

  PERFORM set_config('app.retention_cleanup', 'on', true);
  WITH candidates AS MATERIALIZED (
    SELECT job.id
    FROM public.jobs job
    WHERE job.state IN ('succeeded', 'cancelled')
      AND job.terminal_at <= clock_timestamp() - CASE
        WHEN EXISTS (
          SELECT 1 FROM public.job_attempts attempt
          WHERE attempt.job_id = job.id
            AND attempt.outcome IN ('retryable_failure', 'non_retryable_failure', 'abandoned')
        ) OR EXISTS (
          SELECT 1 FROM public.external_operations operation
          WHERE operation.job_id = job.id
        ) THEN interval '90 days'
        ELSE interval '30 days'
      END
      AND NOT EXISTS (
        SELECT 1 FROM public.external_operations operation
        WHERE operation.job_id = job.id
          AND operation.state IN ('prepared', 'in_flight', 'unknown')
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.external_operations operation
        WHERE operation.job_id = job.id
          AND operation.resolved_at > clock_timestamp() - interval '90 days'
      )
    ORDER BY job.terminal_at, job.id
    LIMIT p_batch_size
    FOR UPDATE OF job SKIP LOCKED
  ), deleted_external_operations AS (
    DELETE FROM public.external_operations operation USING candidates
    WHERE operation.job_id = candidates.id RETURNING operation.id
  ), deleted_effects AS (
    DELETE FROM public.job_effects effect USING candidates
    WHERE effect.job_id = candidates.id RETURNING effect.id
  ), deleted_actions AS (
    DELETE FROM public.job_actions action USING candidates
    WHERE action.job_id = candidates.id RETURNING action.id
  ), deleted_attempts AS (
    DELETE FROM public.job_attempts attempt USING candidates
    WHERE attempt.job_id = candidates.id RETURNING attempt.id
  ), deleted_jobs AS (
    DELETE FROM public.jobs job USING candidates
    WHERE job.id = candidates.id RETURNING job.id
  ) SELECT count(*) INTO removed FROM deleted_jobs;
  deleted_count := deleted_count + coalesce(removed, 0);
  PERFORM set_config('app.retention_cleanup', 'off', true);

  WITH candidates AS (
    SELECT event.id
    FROM public.outbox_events event
    WHERE event.dispatch_completed_at <= clock_timestamp() - interval '30 days'
      AND NOT EXISTS (SELECT 1 FROM public.jobs job WHERE job.event_id = event.id)
    ORDER BY event.dispatch_completed_at, event.id
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  ) DELETE FROM public.outbox_events event USING candidates
    WHERE event.id = candidates.id;
  GET DIAGNOSTICS removed = ROW_COUNT;
  deleted_count := deleted_count + removed;

  RETURN deleted_count;
END;
$$;

ALTER FUNCTION app.guard_job_attempt_history() OWNER TO cumulore_migration;
ALTER FUNCTION app.cleanup_durable_processing(integer) OWNER TO cumulore_migration;
REVOKE ALL ON FUNCTION app.guard_job_attempt_history(), app.cleanup_durable_processing(integer)
  FROM PUBLIC, cumulore_web, cumulore_break_glass;
GRANT EXECUTE ON FUNCTION app.cleanup_durable_processing(integer) TO cumulore_worker;

RESET ROLE;
