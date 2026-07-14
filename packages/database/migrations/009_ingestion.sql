SET LOCAL ROLE cumulore_migration;

CREATE TYPE source_format AS ENUM ('pdf', 'txt', 'pasted_text');
CREATE TYPE source_state AS ENUM (
  'awaiting_upload',
  'validating',
  'duplicate_confirmation_required',
  'extracting',
  'succeeded',
  'action_required',
  'failed_terminal',
  'cancelled'
);
CREATE TYPE upload_session_state AS ENUM ('awaiting_upload', 'uploaded', 'expired');

CREATE TABLE sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  folder_id uuid NOT NULL,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 240),
  state source_state NOT NULL DEFAULT 'awaiting_upload',
  duplicate_of_source_id uuid,
  created_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, id),
  FOREIGN KEY (workspace_id, folder_id) REFERENCES folders(workspace_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (workspace_id, duplicate_of_source_id) REFERENCES sources(workspace_id, id) ON DELETE RESTRICT,
  CHECK (duplicate_of_source_id IS NULL OR duplicate_of_source_id <> id)
);

CREATE TABLE source_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  source_id uuid NOT NULL,
  format source_format NOT NULL,
  original_filename text,
  content_type text NOT NULL CHECK (char_length(content_type) BETWEEN 1 AND 120),
  byte_size bigint NOT NULL CHECK (byte_size > 0 AND byte_size <= 52428800),
  sha256 bytea CHECK (sha256 IS NULL OR octet_length(sha256) = 32),
  quarantine_key text NOT NULL CHECK (char_length(quarantine_key) BETWEEN 1 AND 500),
  parser_version text,
  quality_report jsonb,
  failure_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  extracted_at timestamptz,
  UNIQUE (workspace_id, id),
  UNIQUE (workspace_id, source_id, id),
  FOREIGN KEY (workspace_id, source_id) REFERENCES sources(workspace_id, id) ON DELETE CASCADE,
  CHECK (quality_report IS NULL OR jsonb_typeof(quality_report) = 'object'),
  CHECK ((parser_version IS NULL AND extracted_at IS NULL) OR (parser_version IS NOT NULL AND extracted_at IS NOT NULL)),
  CHECK (failure_code IS NULL OR char_length(failure_code) BETWEEN 1 AND 120)
);

CREATE TABLE upload_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  source_id uuid NOT NULL,
  actor_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  quarantine_key text NOT NULL UNIQUE CHECK (char_length(quarantine_key) BETWEEN 1 AND 500),
  expected_content_type text NOT NULL CHECK (char_length(expected_content_type) BETWEEN 1 AND 120),
  expected_byte_size bigint NOT NULL CHECK (expected_byte_size > 0 AND expected_byte_size <= 52428800),
  state upload_session_state NOT NULL DEFAULT 'awaiting_upload',
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  uploaded_at timestamptz,
  UNIQUE (workspace_id, id),
  FOREIGN KEY (workspace_id, source_id) REFERENCES sources(workspace_id, id) ON DELETE CASCADE,
  CHECK ((state = 'uploaded' AND uploaded_at IS NOT NULL) OR (state <> 'uploaded' AND uploaded_at IS NULL))
);

CREATE TABLE extraction_elements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  source_version_id uuid NOT NULL,
  ordinal integer NOT NULL CHECK (ordinal >= 0),
  element_kind text NOT NULL CHECK (element_kind IN ('heading', 'paragraph', 'table', 'page')),
  text_content text NOT NULL CHECK (char_length(text_content) > 0),
  locator jsonb NOT NULL CHECK (jsonb_typeof(locator) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, source_version_id, ordinal),
  FOREIGN KEY (workspace_id, source_version_id) REFERENCES source_versions(workspace_id, id) ON DELETE CASCADE
);

CREATE INDEX sources_workspace_state_idx ON sources (workspace_id, state, created_at, id);
CREATE INDEX source_versions_workspace_hash_idx ON source_versions (workspace_id, sha256)
  WHERE sha256 IS NOT NULL;
CREATE INDEX upload_sessions_expiry_idx ON upload_sessions (expires_at, id)
  WHERE state = 'awaiting_upload';
CREATE INDEX extraction_elements_source_idx ON extraction_elements (workspace_id, source_version_id, ordinal);

ALTER TABLE sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE sources FORCE ROW LEVEL SECURITY;
CREATE POLICY sources_workspace_access ON sources FOR ALL TO cumulore_web
  USING (workspace_id = app.current_workspace_id() AND app.active_workspace_member(workspace_id))
  WITH CHECK (workspace_id = app.current_workspace_id() AND app.active_workspace_member(workspace_id));
CREATE POLICY sources_migration ON sources FOR ALL TO cumulore_migration USING (true) WITH CHECK (true);

ALTER TABLE source_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_versions FORCE ROW LEVEL SECURITY;
CREATE POLICY source_versions_workspace_access ON source_versions FOR ALL TO cumulore_web
  USING (workspace_id = app.current_workspace_id() AND app.active_workspace_member(workspace_id))
  WITH CHECK (workspace_id = app.current_workspace_id() AND app.active_workspace_member(workspace_id));
CREATE POLICY source_versions_migration ON source_versions FOR ALL TO cumulore_migration USING (true) WITH CHECK (true);

ALTER TABLE upload_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE upload_sessions FORCE ROW LEVEL SECURITY;
CREATE POLICY upload_sessions_workspace_access ON upload_sessions FOR ALL TO cumulore_web
  USING (workspace_id = app.current_workspace_id() AND actor_user_id = app.current_user_id())
  WITH CHECK (workspace_id = app.current_workspace_id() AND actor_user_id = app.current_user_id());
CREATE POLICY upload_sessions_migration ON upload_sessions FOR ALL TO cumulore_migration USING (true) WITH CHECK (true);

ALTER TABLE extraction_elements ENABLE ROW LEVEL SECURITY;
ALTER TABLE extraction_elements FORCE ROW LEVEL SECURITY;
CREATE POLICY extraction_elements_workspace_access ON extraction_elements FOR SELECT TO cumulore_web
  USING (workspace_id = app.current_workspace_id() AND app.active_workspace_member(workspace_id));
CREATE POLICY extraction_elements_migration ON extraction_elements FOR ALL TO cumulore_migration USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION app.create_upload_session(
  p_folder_id uuid,
  p_title text,
  p_format source_format,
  p_content_type text,
  p_byte_size bigint,
  p_expires_at timestamptz
) RETURNS TABLE (source_id uuid, source_version_id uuid, upload_session_id uuid, quarantine_key text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, app AS $$
DECLARE new_source uuid; new_version uuid; new_session uuid; new_key text;
BEGIN
  IF app.current_user_id() IS NULL OR app.current_workspace_id() IS NULL
    OR NOT app.active_workspace_member(app.current_workspace_id()) THEN
    RAISE EXCEPTION 'authenticated workspace actor is required' USING ERRCODE = '42501';
  END IF;
  IF p_expires_at <= clock_timestamp() OR p_expires_at > clock_timestamp() + interval '1 hour' THEN
    RAISE EXCEPTION 'upload expiry must be within one hour' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM folders WHERE id = p_folder_id AND workspace_id = app.current_workspace_id()) THEN
    RAISE EXCEPTION 'folder is not in the workspace' USING ERRCODE = '42501';
  END IF;
  new_key := 'quarantine/' || app.current_workspace_id()::text || '/' || gen_random_uuid()::text;
  INSERT INTO sources (workspace_id, folder_id, title, created_by_user_id)
  VALUES (app.current_workspace_id(), p_folder_id, p_title, app.current_user_id()) RETURNING id INTO new_source;
  INSERT INTO source_versions (workspace_id, source_id, format, original_filename, content_type, byte_size, quarantine_key)
  VALUES (app.current_workspace_id(), new_source, p_format, p_title, p_content_type, p_byte_size, new_key)
  RETURNING id INTO new_version;
  INSERT INTO upload_sessions (workspace_id, source_id, actor_user_id, quarantine_key, expected_content_type, expected_byte_size, expires_at)
  VALUES (app.current_workspace_id(), new_source, app.current_user_id(), new_key, p_content_type, p_byte_size, p_expires_at)
  RETURNING id INTO new_session;
  RETURN QUERY SELECT new_source, new_version, new_session, new_key;
END $$;

CREATE OR REPLACE FUNCTION app.finalize_upload(
  p_upload_session_id uuid,
  p_actual_byte_size bigint,
  p_client_sha256 bytea DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, app AS $$
DECLARE session_row public.upload_sessions%ROWTYPE;
BEGIN
  IF app.current_user_id() IS NULL OR app.current_workspace_id() IS NULL
    OR NOT app.active_workspace_member(app.current_workspace_id()) THEN
    RAISE EXCEPTION 'authenticated workspace actor is required' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO session_row FROM upload_sessions
  WHERE id = p_upload_session_id AND workspace_id = app.current_workspace_id()
    AND actor_user_id = app.current_user_id() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'upload session not found' USING ERRCODE = '42501'; END IF;
  IF session_row.state <> 'awaiting_upload' OR session_row.expires_at <= clock_timestamp() THEN
    RAISE EXCEPTION 'upload session is not finalizable' USING ERRCODE = '22023';
  END IF;
  IF p_actual_byte_size <> session_row.expected_byte_size THEN
    RAISE EXCEPTION 'uploaded size does not match expected size' USING ERRCODE = '22023';
  END IF;
  UPDATE upload_sessions SET state = 'uploaded', uploaded_at = clock_timestamp() WHERE id = session_row.id;
  UPDATE sources SET state = 'validating', updated_at = clock_timestamp() WHERE id = session_row.source_id;
  UPDATE source_versions SET sha256 = p_client_sha256 WHERE id = (
    SELECT id FROM source_versions WHERE source_id = session_row.source_id ORDER BY created_at DESC LIMIT 1
  );
  INSERT INTO outbox_events (scope, workspace_id, event_type, schema_version, actor_type, actor_id, correlation_id, payload)
  VALUES ('workspace', session_row.workspace_id, 'source.upload.finalized', 1, 'user', app.current_user_id(), gen_random_uuid(),
    jsonb_build_object('source_id', session_row.source_id, 'upload_session_id', session_row.id, 'quarantine_key', session_row.quarantine_key));
  RETURN session_row.source_id;
END $$;

CREATE OR REPLACE FUNCTION app.record_source_validation(
  p_source_id uuid, p_sha256 bytea
) RETURNS source_state
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, app AS $$
DECLARE version_row public.source_versions%ROWTYPE; duplicate_id uuid; next_state source_state;
BEGIN
  SELECT * INTO version_row FROM source_versions WHERE source_id = p_source_id AND workspace_id = app.current_workspace_id() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'source version not found' USING ERRCODE = '42501'; END IF;
  SELECT source_id INTO duplicate_id FROM source_versions
  WHERE workspace_id = app.current_workspace_id() AND sha256 = p_sha256 AND source_id <> p_source_id LIMIT 1;
  next_state := CASE WHEN duplicate_id IS NULL THEN 'extracting'::source_state ELSE 'duplicate_confirmation_required'::source_state END;
  UPDATE source_versions SET sha256 = p_sha256 WHERE id = version_row.id;
  UPDATE sources SET state = next_state, duplicate_of_source_id = duplicate_id, updated_at = clock_timestamp() WHERE id = p_source_id;
  RETURN next_state;
END $$;

CREATE OR REPLACE FUNCTION app.record_source_extraction(
  p_source_id uuid, p_parser_version text, p_quality_report jsonb, p_elements jsonb
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, app AS $$
DECLARE version_id uuid; element jsonb; i integer := 0;
BEGIN
  SELECT id INTO version_id FROM source_versions WHERE source_id = p_source_id AND workspace_id = app.current_workspace_id() FOR UPDATE;
  IF NOT FOUND OR jsonb_array_length(p_elements) = 0 THEN RETURN false; END IF;
  IF NOT EXISTS (SELECT 1 FROM sources WHERE id = p_source_id AND workspace_id = app.current_workspace_id() AND state = 'extracting') THEN RETURN false; END IF;
  DELETE FROM extraction_elements WHERE source_version_id = version_id;
  FOR element IN SELECT value FROM jsonb_array_elements(p_elements) LOOP
    IF jsonb_typeof(element) <> 'object' OR char_length(element->>'text') = 0 THEN
      RAISE EXCEPTION 'extraction element is invalid' USING ERRCODE = '22023';
    END IF;
    INSERT INTO extraction_elements (workspace_id, source_version_id, ordinal, element_kind, text_content, locator)
    VALUES (app.current_workspace_id(), version_id, i, element->>'kind', element->>'text', element->'locator');
    i := i + 1;
  END LOOP;
  UPDATE source_versions SET parser_version = p_parser_version, quality_report = p_quality_report, extracted_at = clock_timestamp(), failure_code = NULL WHERE id = version_id;
  UPDATE sources SET state = 'succeeded', updated_at = clock_timestamp() WHERE id = p_source_id;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION app.fail_source_extraction(p_source_id uuid, p_failure_code text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, app AS $$
DECLARE version_id uuid;
BEGIN
  SELECT id INTO version_id FROM source_versions WHERE source_id = p_source_id AND workspace_id = app.current_workspace_id() FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  UPDATE source_versions SET failure_code = p_failure_code WHERE id = version_id;
  UPDATE sources SET state = 'failed_terminal', updated_at = clock_timestamp() WHERE id = p_source_id AND state IN ('validating', 'extracting');
  RETURN FOUND;
END $$;

ALTER FUNCTION app.create_upload_session(uuid, text, source_format, text, bigint, timestamptz) OWNER TO cumulore_migration;
ALTER FUNCTION app.finalize_upload(uuid, bigint, bytea) OWNER TO cumulore_migration;
ALTER FUNCTION app.record_source_validation(uuid, bytea) OWNER TO cumulore_migration;
ALTER FUNCTION app.record_source_extraction(uuid, text, jsonb, jsonb) OWNER TO cumulore_migration;
ALTER FUNCTION app.fail_source_extraction(uuid, text) OWNER TO cumulore_migration;
GRANT EXECUTE ON FUNCTION app.create_upload_session(uuid, text, source_format, text, bigint, timestamptz), app.finalize_upload(uuid, bigint, bytea) TO cumulore_web;
GRANT EXECUTE ON FUNCTION app.record_source_validation(uuid, bytea), app.record_source_extraction(uuid, text, jsonb, jsonb), app.fail_source_extraction(uuid, text) TO cumulore_worker;
GRANT SELECT ON sources, source_versions, upload_sessions, extraction_elements TO cumulore_web;
GRANT USAGE ON TYPE source_format, source_state TO cumulore_web, cumulore_worker;
GRANT SELECT, UPDATE ON sources, source_versions TO cumulore_worker;
GRANT INSERT, UPDATE ON extraction_elements TO cumulore_worker;
ALTER TABLE sources OWNER TO cumulore_migration;
ALTER TABLE source_versions OWNER TO cumulore_migration;
ALTER TABLE upload_sessions OWNER TO cumulore_migration;
ALTER TABLE extraction_elements OWNER TO cumulore_migration;
RESET ROLE;
