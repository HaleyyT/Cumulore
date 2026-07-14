SET LOCAL ROLE cumulore_migration;

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
  GET DIAGNOSTICS removed = ROW_COUNT; deleted_count := deleted_count + removed;
  WITH candidates AS (
    SELECT job.id FROM public.jobs job
    WHERE job.state IN ('succeeded', 'cancelled')
      AND job.terminal_at <= clock_timestamp() - interval '30 days'
      AND NOT EXISTS (SELECT 1 FROM public.external_operations operation WHERE operation.job_id = job.id)
    ORDER BY job.terminal_at, job.id LIMIT p_batch_size FOR UPDATE SKIP LOCKED
  ), deleted_effects AS (
    DELETE FROM public.job_effects effect USING candidates
    WHERE effect.job_id = candidates.id RETURNING effect.id
  ), deleted_actions AS (
    DELETE FROM public.job_actions action USING candidates
    WHERE action.job_id = candidates.id RETURNING action.id
  ), deleted_attempts AS (
    DELETE FROM public.job_attempts attempt USING candidates
    WHERE attempt.job_id = candidates.id AND attempt.outcome IN ('succeeded', 'cancelled')
    RETURNING attempt.id
  ), deleted_jobs AS (
    DELETE FROM public.jobs job USING candidates WHERE job.id = candidates.id RETURNING job.id
  ) SELECT count(*) INTO removed FROM deleted_jobs;
  deleted_count := deleted_count + coalesce(removed, 0);
  WITH candidates AS (
    SELECT event.id FROM public.outbox_events event
    WHERE event.dispatch_completed_at <= clock_timestamp() - interval '30 days'
      AND NOT EXISTS (SELECT 1 FROM public.jobs job WHERE job.event_id = event.id)
    ORDER BY event.dispatch_completed_at, event.id LIMIT p_batch_size FOR UPDATE SKIP LOCKED
  ) DELETE FROM public.outbox_events event USING candidates WHERE event.id = candidates.id;
  GET DIAGNOSTICS removed = ROW_COUNT; deleted_count := deleted_count + removed;
  RETURN deleted_count;
END;
$$;

CREATE OR REPLACE FUNCTION app.durable_queue_metrics()
RETURNS TABLE (pending_count bigint, retry_wait_count bigint, running_count bigint,
  expired_lease_count bigint, dead_letter_count bigint, unknown_external_count bigint,
  oldest_pending_age_seconds double precision)
LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, public, app AS $$
  SELECT count(*) FILTER (WHERE state = 'pending'), count(*) FILTER (WHERE state = 'retry_wait'),
    count(*) FILTER (WHERE state = 'running'), count(*) FILTER (WHERE state = 'running' AND lease_expires_at <= clock_timestamp()),
    count(*) FILTER (WHERE state = 'dead_letter'),
    (SELECT count(*) FROM public.external_operations WHERE state = 'unknown'),
    coalesce(extract(epoch FROM (clock_timestamp() - min(created_at) FILTER (WHERE state IN ('pending', 'retry_wait')))), 0)
  FROM public.jobs;
$$;

CREATE OR REPLACE FUNCTION app.maintenance_tick(p_owner text)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, app AS $$
DECLARE workspace_row record; cleaned integer;
BEGIN
  IF p_owner IS NULL OR btrim(p_owner) = '' OR char_length(p_owner) > 120 THEN
    RAISE EXCEPTION 'maintenance owner must contain between 1 and 120 non-blank characters'
      USING ERRCODE = '22023';
  END IF;
  FOR workspace_row IN SELECT id FROM public.workspaces ORDER BY id LOOP
    PERFORM set_config('app.workspace_id', workspace_row.id::text, true);
    PERFORM app.reclaim_expired_jobs();
  END LOOP;
  PERFORM set_config('app.workspace_id', '', true);
  SELECT app.cleanup_durable_processing(100) INTO cleaned;
  RETURN cleaned;
END;
$$;

ALTER FUNCTION app.cleanup_durable_processing(integer) OWNER TO cumulore_migration;
ALTER FUNCTION app.durable_queue_metrics() OWNER TO cumulore_migration;
ALTER FUNCTION app.maintenance_tick(text) OWNER TO cumulore_migration;
REVOKE ALL ON FUNCTION app.cleanup_durable_processing(integer), app.durable_queue_metrics(), app.maintenance_tick(text) FROM PUBLIC, cumulore_web, cumulore_break_glass;
GRANT EXECUTE ON FUNCTION app.cleanup_durable_processing(integer), app.durable_queue_metrics(), app.maintenance_tick(text) TO cumulore_worker;
RESET ROLE;
