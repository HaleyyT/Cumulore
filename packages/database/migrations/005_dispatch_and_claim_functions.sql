GRANT USAGE ON SCHEMA app TO cumulore_worker;

SET LOCAL ROLE cumulore_migration;

CREATE OR REPLACE FUNCTION app.dispatch_outbox(p_batch_size integer DEFAULT 50)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, app
AS $$
DECLARE
  dispatched_event_count integer;
BEGIN
  IF p_batch_size IS NULL OR p_batch_size NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'batch size must be between 1 and 100'
      USING ERRCODE = '22023';
  END IF;

  WITH selected_events AS MATERIALIZED (
    SELECT event.id
    FROM public.outbox_events AS event
    WHERE event.dispatch_completed_at IS NULL
    ORDER BY event.occurred_at, event.id
    FOR UPDATE OF event SKIP LOCKED
    LIMIT p_batch_size
  ),
  applicable_handlers AS MATERIALIZED (
    SELECT
      event.workspace_id,
      event.id AS event_id,
      event.event_type,
      event.schema_version,
      handler.handler_name,
      handler.handler_version
    FROM selected_events AS selected
    JOIN public.outbox_events AS event ON event.id = selected.id
    JOIN public.event_handlers AS handler
      ON handler.event_type = event.event_type
      AND handler.schema_version = event.schema_version
      AND handler.active
    WHERE event.workspace_id IS NOT NULL
      AND (NOT handler.requires_workspace OR event.workspace_id IS NOT NULL)
  ),
  inserted_jobs AS (
    INSERT INTO public.jobs (
      workspace_id,
      event_id,
      event_type,
      event_schema_version,
      handler_name,
      handler_version
    )
    SELECT
      applicable.workspace_id,
      applicable.event_id,
      applicable.event_type,
      applicable.schema_version,
      applicable.handler_name,
      applicable.handler_version
    FROM applicable_handlers AS applicable
    ON CONFLICT (event_id, handler_name, handler_version) DO NOTHING
    RETURNING event_id
  ),
  dispatch_counts AS (
    SELECT
      selected.id AS event_id,
      count(applicable.event_id)::integer AS handler_count
    FROM selected_events AS selected
    LEFT JOIN applicable_handlers AS applicable
      ON applicable.event_id = selected.id
    GROUP BY selected.id
  ),
  completed_events AS (
    UPDATE public.outbox_events AS event
    SET
      dispatch_completed_at = clock_timestamp(),
      dispatched_handler_count = dispatch.handler_count
    FROM dispatch_counts AS dispatch
    WHERE event.id = dispatch.event_id
    RETURNING event.id
  )
  SELECT count(*) INTO dispatched_event_count
  FROM completed_events;

  RETURN dispatched_event_count;
END;
$$;

CREATE OR REPLACE FUNCTION app.claim_jobs(
  p_worker_owner text,
  p_batch_size integer DEFAULT 1,
  p_lease_seconds integer DEFAULT 60
)
RETURNS TABLE (
  job_id uuid,
  workspace_id uuid,
  event_id uuid,
  event_type text,
  schema_version integer,
  correlation_id uuid,
  causation_id uuid,
  handler_name text,
  handler_version integer,
  attempt_id uuid,
  lease_generation bigint,
  lease_expires_at timestamptz,
  payload jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, app
AS $$
BEGIN
  IF p_worker_owner IS NULL
    OR btrim(p_worker_owner) = ''
    OR char_length(p_worker_owner) > 120
  THEN
    RAISE EXCEPTION 'worker owner must contain between 1 and 120 non-blank characters'
      USING ERRCODE = '22023';
  END IF;

  IF p_batch_size IS NULL OR p_batch_size NOT BETWEEN 1 AND 10 THEN
    RAISE EXCEPTION 'batch size must be between 1 and 10'
      USING ERRCODE = '22023';
  END IF;

  IF p_lease_seconds IS NULL OR p_lease_seconds NOT BETWEEN 1 AND 300 THEN
    RAISE EXCEPTION 'lease seconds must be between 1 and 300'
      USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  WITH claim_clock AS MATERIALIZED (
    SELECT clock_timestamp() AS claimed_at
  ),
  selected_jobs AS MATERIALIZED (
    SELECT
      job.id,
      gen_random_uuid() AS new_attempt_id,
      claim_clock.claimed_at
    FROM public.jobs AS job
    CROSS JOIN claim_clock
    WHERE job.state IN ('pending', 'retry_wait')
      AND job.available_at <= claim_clock.claimed_at
      AND job.generation_attempt_count < 5
      AND job.lifetime_attempt_count < 10
    ORDER BY job.available_at, job.created_at, job.id
    FOR UPDATE OF job SKIP LOCKED
    LIMIT p_batch_size
  ),
  claimed_jobs AS (
    UPDATE public.jobs AS job
    SET
      state = 'running',
      generation_attempt_count = job.generation_attempt_count + 1,
      lifetime_attempt_count = job.lifetime_attempt_count + 1,
      lease_generation = job.lease_generation + 1,
      active_attempt_id = selected.new_attempt_id,
      worker_owner = p_worker_owner,
      lease_expires_at = selected.claimed_at + make_interval(secs => p_lease_seconds),
      updated_at = selected.claimed_at
    FROM selected_jobs AS selected
    WHERE job.id = selected.id
    RETURNING
      job.id,
      job.workspace_id,
      job.event_id,
      job.event_type,
      job.event_schema_version,
      job.handler_name,
      job.handler_version,
      job.retry_generation,
      job.generation_attempt_count,
      job.lifetime_attempt_count,
      job.lease_generation,
      job.worker_owner,
      job.lease_expires_at,
      job.available_at,
      job.created_at,
      job.active_attempt_id
  ),
  inserted_attempts AS (
    INSERT INTO public.job_attempts AS new_attempt (
      id,
      workspace_id,
      job_id,
      retry_generation,
      generation_attempt_number,
      lifetime_attempt_number,
      lease_generation,
      worker_owner
    )
    SELECT
      claimed.active_attempt_id,
      claimed.workspace_id,
      claimed.id,
      claimed.retry_generation,
      claimed.generation_attempt_count,
      claimed.lifetime_attempt_count,
      claimed.lease_generation,
      claimed.worker_owner
    FROM claimed_jobs AS claimed
    RETURNING new_attempt.id, new_attempt.workspace_id, new_attempt.job_id
  )
  SELECT
    claimed.id,
    claimed.workspace_id,
    claimed.event_id,
    claimed.event_type,
    claimed.event_schema_version,
    event.correlation_id,
    event.causation_id,
    claimed.handler_name,
    claimed.handler_version,
    attempt.id,
    claimed.lease_generation,
    claimed.lease_expires_at,
    event.payload
  FROM claimed_jobs AS claimed
  JOIN inserted_attempts AS attempt
    ON attempt.workspace_id = claimed.workspace_id
    AND attempt.job_id = claimed.id
    AND attempt.id = claimed.active_attempt_id
  JOIN public.outbox_events AS event
    ON event.workspace_id = claimed.workspace_id
    AND event.id = claimed.event_id
    AND event.event_type = claimed.event_type
    AND event.schema_version = claimed.event_schema_version
  ORDER BY claimed.available_at, claimed.created_at, claimed.id;
END;
$$;

ALTER FUNCTION app.dispatch_outbox(integer) OWNER TO cumulore_migration;
ALTER FUNCTION app.claim_jobs(text, integer, integer) OWNER TO cumulore_migration;

REVOKE ALL ON FUNCTION app.dispatch_outbox(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.claim_jobs(text, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.dispatch_outbox(integer) FROM cumulore_web, cumulore_break_glass;
REVOKE ALL ON FUNCTION app.claim_jobs(text, integer, integer) FROM cumulore_web, cumulore_break_glass;

GRANT EXECUTE ON FUNCTION app.dispatch_outbox(integer) TO cumulore_worker;
GRANT EXECUTE ON FUNCTION app.claim_jobs(text, integer, integer) TO cumulore_worker;

RESET ROLE;
