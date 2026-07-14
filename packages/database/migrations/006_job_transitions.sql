SET LOCAL ROLE cumulore_migration;

-- A running cancellation request is an auditable action without being a job
-- state transition until the worker acknowledges it. The state columns on the
-- action row therefore intentionally remain running/running for that action.
ALTER TABLE public.job_actions
  DROP CONSTRAINT job_actions_state_change_check;
ALTER TABLE public.job_actions
  ADD CONSTRAINT job_actions_state_change_check CHECK (
    previous_state <> next_state
    OR (
      action = 'cancellation_requested'
      AND previous_state = 'running'
      AND next_state = 'running'
    )
  );

CREATE OR REPLACE FUNCTION app.renew_job_lease(
  p_job uuid,
  p_attempt uuid,
  p_owner text,
  p_generation bigint,
  p_lease_seconds integer DEFAULT 60
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, app
AS $$
BEGIN
  IF app.current_workspace_id() IS NULL THEN
    RAISE EXCEPTION 'transaction workspace is required' USING ERRCODE = '42501';
  END IF;
  IF p_owner IS NULL OR btrim(p_owner) = '' OR char_length(p_owner) > 120 THEN
    RAISE EXCEPTION 'worker owner must contain between 1 and 120 non-blank characters'
      USING ERRCODE = '22023';
  END IF;
  IF p_lease_seconds IS NULL OR p_lease_seconds NOT BETWEEN 1 AND 300 THEN
    RAISE EXCEPTION 'lease seconds must be between 1 and 300'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.jobs
  SET lease_expires_at = clock_timestamp() + make_interval(secs => p_lease_seconds),
      updated_at = clock_timestamp()
  WHERE workspace_id = app.current_workspace_id()
    AND id = p_job
    AND active_attempt_id = p_attempt
    AND worker_owner = p_owner
    AND lease_generation = p_generation
    AND state = 'running'
    AND lease_expires_at > clock_timestamp();
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION app.complete_job(
  p_job uuid,
  p_attempt uuid,
  p_owner text,
  p_generation bigint
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

  SELECT * INTO job_row
  FROM public.jobs
  WHERE workspace_id = app.current_workspace_id()
    AND id = p_job
    AND active_attempt_id = p_attempt
    AND worker_owner = p_owner
    AND lease_generation = p_generation
    AND state = 'running'
    AND cancel_requested_at IS NULL
    AND handler_name = 'run_synthetic'
  FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;

  UPDATE public.jobs
  SET state = 'succeeded',
      terminal_at = clock_timestamp(),
      active_attempt_id = NULL,
      worker_owner = NULL,
      lease_expires_at = NULL,
      updated_at = clock_timestamp()
  WHERE workspace_id = job_row.workspace_id AND id = job_row.id;
  UPDATE public.job_attempts
  SET ended_at = clock_timestamp(), outcome = 'succeeded'
  WHERE workspace_id = job_row.workspace_id AND job_id = job_row.id AND id = p_attempt;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION app.fail_job(
  p_job uuid,
  p_attempt uuid,
  p_owner text,
  p_generation bigint,
  p_retryable boolean,
  p_error text,
  p_fraction numeric DEFAULT 0
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, app
AS $$
DECLARE
  job_row public.jobs%ROWTYPE;
  delay_seconds numeric;
  next_state public.durable_job_state;
  terminal_time timestamptz;
BEGIN
  IF app.current_workspace_id() IS NULL THEN
    RAISE EXCEPTION 'transaction workspace is required' USING ERRCODE = '42501';
  END IF;
  IF p_retryable IS NULL OR p_error IS NULL OR p_error !~ '^[a-z0-9_.-]+$'
     OR char_length(p_error) > 120 THEN
    RAISE EXCEPTION 'safe retry classification and error code are required'
      USING ERRCODE = '22023';
  END IF;
  IF p_fraction IS NULL OR p_fraction < 0 OR p_fraction > 1 THEN
    RAISE EXCEPTION 'fraction must be between 0 and 1' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO job_row
  FROM public.jobs
  WHERE workspace_id = app.current_workspace_id()
    AND id = p_job
    AND active_attempt_id = p_attempt
    AND worker_owner = p_owner
    AND lease_generation = p_generation
    AND state = 'running'
  FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;

  IF p_retryable
     AND job_row.generation_attempt_count < 5
     AND job_row.lifetime_attempt_count < 10 THEN
    next_state := 'retry_wait';
    terminal_time := NULL;
  ELSE
    next_state := 'dead_letter';
    terminal_time := clock_timestamp();
  END IF;
  delay_seconds := p_fraction * least(
    900,
    5 * power(2, job_row.generation_attempt_count - 1)
  );

  UPDATE public.job_attempts
  SET ended_at = clock_timestamp(),
      outcome = CASE
        WHEN p_retryable THEN 'retryable_failure'::public.job_attempt_outcome
        ELSE 'non_retryable_failure'::public.job_attempt_outcome
      END,
      retry_classification = CASE
        WHEN p_retryable THEN 'retryable'::public.job_retry_classification
        ELSE 'non_retryable'::public.job_retry_classification
      END,
      safe_error_code = p_error
  WHERE workspace_id = job_row.workspace_id AND job_id = job_row.id AND id = p_attempt;
  UPDATE public.jobs
  SET state = next_state,
      available_at = clock_timestamp() + make_interval(secs => delay_seconds),
      terminal_at = terminal_time,
      active_attempt_id = NULL,
      worker_owner = NULL,
      lease_expires_at = NULL,
      last_error_code = p_error,
      updated_at = clock_timestamp()
  WHERE workspace_id = job_row.workspace_id AND id = job_row.id;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION app.reclaim_expired_jobs() RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, app
AS $$
DECLARE
  job_row public.jobs%ROWTYPE;
  reclaimed_count integer := 0;
  next_state public.durable_job_state;
BEGIN
  IF app.current_workspace_id() IS NULL THEN
    RAISE EXCEPTION 'transaction workspace is required' USING ERRCODE = '42501';
  END IF;

  FOR job_row IN
    SELECT *
    FROM public.jobs
    WHERE workspace_id = app.current_workspace_id()
      AND state = 'running'
      AND lease_expires_at <= clock_timestamp()
    ORDER BY lease_expires_at, id
    FOR UPDATE SKIP LOCKED
  LOOP
    IF job_row.generation_attempt_count >= 5
       OR job_row.lifetime_attempt_count >= 10 THEN
      next_state := 'dead_letter';
    ELSE
      next_state := 'retry_wait';
    END IF;

    UPDATE public.job_attempts
    SET ended_at = clock_timestamp(),
        outcome = 'abandoned',
        retry_classification = 'retryable',
        safe_error_code = 'lease_expired'
    WHERE workspace_id = job_row.workspace_id
      AND job_id = job_row.id
      AND id = job_row.active_attempt_id;
    UPDATE public.jobs
    SET state = next_state,
        available_at = clock_timestamp(),
        terminal_at = CASE WHEN next_state = 'dead_letter' THEN clock_timestamp() ELSE NULL END,
        active_attempt_id = NULL,
        worker_owner = NULL,
        lease_expires_at = NULL,
        lease_generation = lease_generation + 1,
        last_error_code = 'lease_expired',
        updated_at = clock_timestamp()
    WHERE workspace_id = job_row.workspace_id AND id = job_row.id;
    reclaimed_count := reclaimed_count + 1;
  END LOOP;
  RETURN reclaimed_count;
END;
$$;

CREATE OR REPLACE FUNCTION app.request_job_cancellation(p_job uuid) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, app
AS $$
DECLARE
  job_row public.jobs%ROWTYPE;
  actor_id text := app.current_user_id()::text;
BEGIN
  IF app.current_workspace_id() IS NULL OR app.current_user_id() IS NULL
     OR NOT app.active_workspace_member(app.current_workspace_id()) THEN
    RAISE EXCEPTION 'authenticated workspace member is required' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO job_row FROM public.jobs
  WHERE workspace_id = app.current_workspace_id() AND id = p_job
  FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF job_row.state IN ('succeeded', 'dead_letter', 'cancelled') THEN RETURN false; END IF;

  IF job_row.state IN ('pending', 'retry_wait') THEN
    UPDATE public.jobs
    SET state = 'cancelled', terminal_at = clock_timestamp(), updated_at = clock_timestamp()
    WHERE workspace_id = job_row.workspace_id AND id = job_row.id;
    INSERT INTO public.job_actions (
      workspace_id, job_id, action, actor_type, actor_id, previous_state,
      next_state, retry_generation
    ) VALUES (
      job_row.workspace_id, job_row.id, 'cancellation_requested', 'user', actor_id,
      job_row.state, 'cancelled', job_row.retry_generation
    );
    RETURN true;
  END IF;

  IF job_row.cancel_requested_at IS NOT NULL THEN RETURN true; END IF;
  UPDATE public.jobs
  SET cancel_requested_at = clock_timestamp(), updated_at = clock_timestamp()
  WHERE workspace_id = job_row.workspace_id AND id = job_row.id;
  INSERT INTO public.job_actions (
    workspace_id, job_id, action, actor_type, actor_id, previous_state,
    next_state, retry_generation
  ) VALUES (
    job_row.workspace_id, job_row.id, 'cancellation_requested', 'user', actor_id,
    'running', 'running', job_row.retry_generation
  );
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION app.acknowledge_job_cancellation(
  p_job uuid,
  p_attempt uuid,
  p_owner text,
  p_generation bigint
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
    AND cancel_requested_at IS NOT NULL
  FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;

  UPDATE public.jobs
  SET state = 'cancelled', terminal_at = clock_timestamp(),
      active_attempt_id = NULL, worker_owner = NULL, lease_expires_at = NULL,
      updated_at = clock_timestamp()
  WHERE workspace_id = job_row.workspace_id AND id = job_row.id;
  UPDATE public.job_attempts
  SET ended_at = clock_timestamp(), outcome = 'cancelled'
  WHERE workspace_id = job_row.workspace_id AND job_id = job_row.id AND id = p_attempt;
  INSERT INTO public.job_actions (
    workspace_id, job_id, action, actor_type, actor_id, previous_state,
    next_state, retry_generation
  ) VALUES (
    job_row.workspace_id, job_row.id, 'cancelled', 'worker', p_owner,
    'running', 'cancelled', job_row.retry_generation
  );
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION app.manual_retry_job(
  p_job uuid,
  p_reason text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, app
AS $$
DECLARE
  job_row public.jobs%ROWTYPE;
  actor_id text := app.current_user_id()::text;
  next_generation integer;
BEGIN
  IF app.current_workspace_id() IS NULL OR app.current_user_id() IS NULL
     OR NOT app.active_workspace_member(app.current_workspace_id()) THEN
    RAISE EXCEPTION 'authenticated workspace member is required' USING ERRCODE = '42501';
  END IF;
  IF p_reason IS NULL OR btrim(p_reason) = '' OR char_length(p_reason) > 500 THEN
    RAISE EXCEPTION 'manual retry reason must contain between 1 and 500 characters'
      USING ERRCODE = '22023';
  END IF;

  SELECT * INTO job_row FROM public.jobs
  WHERE workspace_id = app.current_workspace_id() AND id = p_job
  FOR UPDATE;
  IF NOT FOUND OR job_row.state <> 'dead_letter' OR job_row.lifetime_attempt_count >= 10 THEN
    RETURN false;
  END IF;
  next_generation := job_row.retry_generation + 1;

  UPDATE public.jobs
  SET state = 'pending', retry_generation = next_generation,
      generation_attempt_count = 0, terminal_at = NULL,
      available_at = clock_timestamp(), last_error_code = NULL,
      updated_at = clock_timestamp()
  WHERE workspace_id = job_row.workspace_id AND id = job_row.id;
  INSERT INTO public.job_actions (
    workspace_id, job_id, action, actor_type, actor_id, reason,
    previous_state, next_state, retry_generation
  ) VALUES (
    job_row.workspace_id, job_row.id, 'manual_retry', 'user', actor_id, p_reason,
    'dead_letter', 'pending', next_generation
  );
  RETURN true;
END;
$$;

ALTER FUNCTION app.renew_job_lease(uuid, uuid, text, bigint, integer) OWNER TO cumulore_migration;
ALTER FUNCTION app.complete_job(uuid, uuid, text, bigint) OWNER TO cumulore_migration;
ALTER FUNCTION app.fail_job(uuid, uuid, text, bigint, boolean, text, numeric) OWNER TO cumulore_migration;
ALTER FUNCTION app.reclaim_expired_jobs() OWNER TO cumulore_migration;
ALTER FUNCTION app.request_job_cancellation(uuid) OWNER TO cumulore_migration;
ALTER FUNCTION app.acknowledge_job_cancellation(uuid, uuid, text, bigint) OWNER TO cumulore_migration;
ALTER FUNCTION app.manual_retry_job(uuid, text) OWNER TO cumulore_migration;

REVOKE ALL ON FUNCTION app.renew_job_lease(uuid, uuid, text, bigint, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.complete_job(uuid, uuid, text, bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.fail_job(uuid, uuid, text, bigint, boolean, text, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.reclaim_expired_jobs() FROM PUBLIC;
REVOKE ALL ON FUNCTION app.request_job_cancellation(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.acknowledge_job_cancellation(uuid, uuid, text, bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.manual_retry_job(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.renew_job_lease(uuid, uuid, text, bigint, integer) FROM cumulore_web, cumulore_break_glass;
REVOKE ALL ON FUNCTION app.complete_job(uuid, uuid, text, bigint) FROM cumulore_web, cumulore_break_glass;
REVOKE ALL ON FUNCTION app.fail_job(uuid, uuid, text, bigint, boolean, text, numeric) FROM cumulore_web, cumulore_break_glass;
REVOKE ALL ON FUNCTION app.reclaim_expired_jobs() FROM cumulore_web, cumulore_break_glass;
REVOKE ALL ON FUNCTION app.acknowledge_job_cancellation(uuid, uuid, text, bigint) FROM cumulore_web, cumulore_break_glass;
GRANT EXECUTE ON FUNCTION app.renew_job_lease(uuid, uuid, text, bigint, integer) TO cumulore_worker;
GRANT EXECUTE ON FUNCTION app.complete_job(uuid, uuid, text, bigint) TO cumulore_worker;
GRANT EXECUTE ON FUNCTION app.fail_job(uuid, uuid, text, bigint, boolean, text, numeric) TO cumulore_worker;
GRANT EXECUTE ON FUNCTION app.reclaim_expired_jobs() TO cumulore_worker;
GRANT EXECUTE ON FUNCTION app.acknowledge_job_cancellation(uuid, uuid, text, bigint) TO cumulore_worker;
REVOKE ALL ON FUNCTION app.request_job_cancellation(uuid), app.manual_retry_job(uuid, text) FROM cumulore_worker, cumulore_break_glass;
GRANT EXECUTE ON FUNCTION app.request_job_cancellation(uuid), app.manual_retry_job(uuid, text) TO cumulore_web;

RESET ROLE;
