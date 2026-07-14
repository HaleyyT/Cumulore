SET LOCAL ROLE cumulore_migration;

DROP FUNCTION app.finalize_upload(uuid, bigint, bytea);

CREATE FUNCTION app.finalize_upload(
  p_upload_session_id uuid,
  p_actual_byte_size bigint,
  p_client_sha256 bytea,
  p_correlation_id uuid,
  p_causation_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, app
AS $$
DECLARE session_row public.upload_sessions%ROWTYPE;
BEGIN
  IF app.current_user_id() IS NULL OR app.current_workspace_id() IS NULL
    OR NOT app.active_workspace_member(app.current_workspace_id()) THEN
    RAISE EXCEPTION 'authenticated workspace actor is required' USING ERRCODE = '42501';
  END IF;
  IF p_correlation_id IS NULL THEN
    RAISE EXCEPTION 'correlation identifier is required' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO session_row FROM public.upload_sessions
  WHERE id = p_upload_session_id AND workspace_id = app.current_workspace_id()
    AND actor_user_id = app.current_user_id() FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'upload session not found' USING ERRCODE = '42501';
  END IF;
  IF session_row.state <> 'awaiting_upload'
    OR session_row.expires_at <= clock_timestamp() THEN
    RAISE EXCEPTION 'upload session is not finalizable' USING ERRCODE = '22023';
  END IF;
  IF p_actual_byte_size <> session_row.expected_byte_size THEN
    RAISE EXCEPTION 'uploaded size does not match expected size' USING ERRCODE = '22023';
  END IF;
  UPDATE public.upload_sessions
  SET state = 'uploaded', uploaded_at = clock_timestamp()
  WHERE id = session_row.id AND workspace_id = session_row.workspace_id;
  UPDATE public.sources
  SET state = 'validating', updated_at = clock_timestamp()
  WHERE id = session_row.source_id AND workspace_id = session_row.workspace_id;
  UPDATE public.source_versions
  SET sha256 = p_client_sha256
  WHERE id = (
    SELECT id FROM public.source_versions
    WHERE source_id = session_row.source_id
      AND workspace_id = session_row.workspace_id
    ORDER BY created_at DESC LIMIT 1
  ) AND workspace_id = session_row.workspace_id;
  INSERT INTO public.outbox_events (
    scope, workspace_id, event_type, schema_version, actor_type, actor_id,
    correlation_id, causation_id, payload
  ) VALUES (
    'workspace', session_row.workspace_id, 'source.upload.finalized', 1,
    'user', app.current_user_id(), p_correlation_id, p_causation_id,
    jsonb_build_object(
      'source_id', session_row.source_id,
      'upload_session_id', session_row.id,
      'quarantine_key', session_row.quarantine_key
    )
  );
  RETURN session_row.source_id;
END;
$$;

ALTER FUNCTION app.finalize_upload(uuid, bigint, bytea, uuid, uuid)
  OWNER TO cumulore_migration;
REVOKE ALL ON FUNCTION app.finalize_upload(uuid, bigint, bytea, uuid, uuid)
  FROM PUBLIC, cumulore_worker, cumulore_break_glass;
GRANT EXECUTE ON FUNCTION app.finalize_upload(uuid, bigint, bytea, uuid, uuid)
  TO cumulore_web;

CREATE OR REPLACE FUNCTION app.operational_metrics()
RETURNS TABLE (
  queue_depth bigint,
  oldest_queue_age_seconds double precision,
  running_jobs bigint,
  expired_leases bigint,
  dead_letters bigint,
  awaiting_upload_sources bigint,
  validating_sources bigint,
  extracting_sources bigint,
  action_required_sources bigint,
  failed_terminal_sources bigint,
  database_connections bigint,
  lock_waiting_connections bigint,
  longest_transaction_seconds double precision
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public, app
AS $$
  WITH queue AS (
    SELECT
      count(*) FILTER (WHERE state IN ('pending', 'retry_wait')) AS queue_depth,
      coalesce(
        extract(epoch FROM (
          clock_timestamp() - min(available_at) FILTER (WHERE state IN ('pending', 'retry_wait'))
        )),
        0
      ) AS oldest_queue_age_seconds,
      count(*) FILTER (WHERE state = 'running') AS running_jobs,
      count(*) FILTER (
        WHERE state = 'running' AND lease_expires_at <= clock_timestamp()
      ) AS expired_leases,
      count(*) FILTER (WHERE state = 'dead_letter') AS dead_letters
    FROM public.jobs
  ), ingestion AS (
    SELECT
      count(*) FILTER (WHERE state = 'awaiting_upload') AS awaiting_upload_sources,
      count(*) FILTER (WHERE state = 'validating') AS validating_sources,
      count(*) FILTER (WHERE state = 'extracting') AS extracting_sources,
      count(*) FILTER (WHERE state = 'action_required') AS action_required_sources,
      count(*) FILTER (WHERE state = 'failed_terminal') AS failed_terminal_sources
    FROM public.sources
  ), database_activity AS (
    SELECT
      count(*) AS database_connections,
      count(*) FILTER (WHERE wait_event_type = 'Lock') AS lock_waiting_connections,
      coalesce(
        max(extract(epoch FROM (clock_timestamp() - xact_start)))
          FILTER (WHERE xact_start IS NOT NULL AND pid <> pg_backend_pid()),
        0
      ) AS longest_transaction_seconds
    FROM pg_catalog.pg_stat_activity
    WHERE datname = current_database()
  )
  SELECT
    queue.queue_depth,
    queue.oldest_queue_age_seconds,
    queue.running_jobs,
    queue.expired_leases,
    queue.dead_letters,
    ingestion.awaiting_upload_sources,
    ingestion.validating_sources,
    ingestion.extracting_sources,
    ingestion.action_required_sources,
    ingestion.failed_terminal_sources,
    database_activity.database_connections,
    database_activity.lock_waiting_connections,
    database_activity.longest_transaction_seconds
  FROM queue CROSS JOIN ingestion CROSS JOIN database_activity;
$$;

ALTER FUNCTION app.operational_metrics() OWNER TO cumulore_migration;
REVOKE ALL ON FUNCTION app.operational_metrics()
  FROM PUBLIC, cumulore_web, cumulore_break_glass;
GRANT EXECUTE ON FUNCTION app.operational_metrics() TO cumulore_worker;

RESET ROLE;
