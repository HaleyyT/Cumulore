SET LOCAL ROLE cumulore_migration;

CREATE TYPE retrieval_scope_mode AS ENUM ('direct', 'descendants');

CREATE TABLE source_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  source_version_id uuid NOT NULL,
  ordinal integer NOT NULL CHECK (ordinal >= 0),
  structural_type text NOT NULL CHECK (structural_type IN ('heading', 'paragraph', 'table', 'page')),
  text_content text NOT NULL CHECK (char_length(text_content) BETWEEN 1 AND 10000),
  locator jsonb NOT NULL CHECK (jsonb_typeof(locator) = 'object'),
  heading_path jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(heading_path) = 'array'),
  token_count integer NOT NULL CHECK (token_count > 0),
  text_checksum bytea NOT NULL CHECK (octet_length(text_checksum) = 32),
  search_vector tsvector GENERATED ALWAYS AS (to_tsvector('simple'::regconfig, text_content)) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, source_version_id, ordinal),
  FOREIGN KEY (workspace_id, source_version_id) REFERENCES source_versions(workspace_id, id) ON DELETE CASCADE
);

CREATE TABLE retrieval_scope_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  folder_id uuid NOT NULL,
  scope_mode retrieval_scope_mode NOT NULL,
  created_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, id),
  FOREIGN KEY (workspace_id, folder_id) REFERENCES folders(workspace_id, id) ON DELETE RESTRICT
);

CREATE TABLE retrieval_scope_sources (
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  snapshot_id uuid NOT NULL,
  source_version_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, snapshot_id, source_version_id),
  FOREIGN KEY (workspace_id, snapshot_id) REFERENCES retrieval_scope_snapshots(workspace_id, id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id, source_version_id) REFERENCES source_versions(workspace_id, id) ON DELETE CASCADE
);

CREATE INDEX source_chunks_search_idx ON source_chunks USING gin (search_vector);
CREATE INDEX source_chunks_source_idx ON source_chunks (workspace_id, source_version_id, ordinal);
CREATE INDEX retrieval_scope_sources_snapshot_idx ON retrieval_scope_sources (workspace_id, snapshot_id, source_version_id);

ALTER TABLE source_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_chunks FORCE ROW LEVEL SECURITY;
CREATE POLICY source_chunks_web_read ON source_chunks FOR SELECT TO cumulore_web
  USING (workspace_id = app.current_workspace_id() AND app.active_workspace_member(workspace_id));
CREATE POLICY source_chunks_migration ON source_chunks FOR ALL TO cumulore_migration USING (true) WITH CHECK (true);

ALTER TABLE retrieval_scope_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE retrieval_scope_snapshots FORCE ROW LEVEL SECURITY;
CREATE POLICY retrieval_snapshots_web_access ON retrieval_scope_snapshots FOR ALL TO cumulore_web
  USING (workspace_id = app.current_workspace_id() AND app.active_workspace_member(workspace_id)
    AND created_by_user_id = app.current_user_id())
  WITH CHECK (workspace_id = app.current_workspace_id() AND app.active_workspace_member(workspace_id)
    AND created_by_user_id = app.current_user_id());
CREATE POLICY retrieval_snapshots_migration ON retrieval_scope_snapshots FOR ALL TO cumulore_migration USING (true) WITH CHECK (true);

ALTER TABLE retrieval_scope_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE retrieval_scope_sources FORCE ROW LEVEL SECURITY;
CREATE POLICY retrieval_scope_sources_web_read ON retrieval_scope_sources FOR SELECT TO cumulore_web
  USING (workspace_id = app.current_workspace_id() AND app.active_workspace_member(workspace_id));
CREATE POLICY retrieval_scope_sources_migration ON retrieval_scope_sources FOR ALL TO cumulore_migration USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION app.record_source_chunks(p_source_id uuid, p_chunks jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, app AS $$
DECLARE version_id uuid; chunk jsonb; index_number integer := 0; inserted_count integer := 0; text_value text;
BEGIN
  IF jsonb_typeof(p_chunks) <> 'array' OR jsonb_array_length(p_chunks) = 0 THEN
    RAISE EXCEPTION 'chunk list must be a non-empty array' USING ERRCODE = '22023';
  END IF;
  SELECT sv.id INTO version_id FROM source_versions sv JOIN sources s
    ON s.workspace_id = sv.workspace_id AND s.id = sv.source_id
  WHERE sv.workspace_id = app.current_workspace_id() AND sv.source_id = p_source_id AND s.state = 'succeeded'
  FOR UPDATE;
  IF NOT FOUND THEN RETURN 0; END IF;
  DELETE FROM source_chunks WHERE workspace_id = app.current_workspace_id() AND source_version_id = version_id;
  FOR chunk IN SELECT value FROM jsonb_array_elements(p_chunks) LOOP
    text_value := trim(chunk->>'text');
    IF jsonb_typeof(chunk) <> 'object' OR text_value IS NULL OR char_length(text_value) = 0
      OR char_length(text_value) > 10000 OR jsonb_typeof(chunk->'locator') <> 'object' THEN
      RAISE EXCEPTION 'chunk is invalid' USING ERRCODE = '22023';
    END IF;
    INSERT INTO source_chunks (
      workspace_id, source_version_id, ordinal, structural_type, text_content,
      locator, heading_path, token_count, text_checksum
    ) VALUES (
      app.current_workspace_id(), version_id, index_number, chunk->>'kind', text_value,
      chunk->'locator', coalesce(chunk->'heading_path', '[]'::jsonb),
      greatest(1, cardinality(regexp_split_to_array(text_value, '\\s+'))), digest(text_value, 'sha256')
    );
    index_number := index_number + 1;
    inserted_count := inserted_count + 1;
  END LOOP;
  RETURN inserted_count;
END $$;

CREATE OR REPLACE FUNCTION app.create_retrieval_scope_snapshot(
  p_folder_id uuid, p_scope_mode retrieval_scope_mode
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, app AS $$
DECLARE snapshot_id uuid;
BEGIN
  IF app.current_user_id() IS NULL OR app.current_workspace_id() IS NULL
    OR NOT app.active_workspace_member(app.current_workspace_id()) THEN
    RAISE EXCEPTION 'authenticated workspace actor is required' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM folders WHERE id = p_folder_id AND workspace_id = app.current_workspace_id()) THEN
    RAISE EXCEPTION 'folder is not in the workspace' USING ERRCODE = '42501';
  END IF;
  INSERT INTO retrieval_scope_snapshots (workspace_id, folder_id, scope_mode, created_by_user_id)
  VALUES (app.current_workspace_id(), p_folder_id, p_scope_mode, app.current_user_id())
  RETURNING id INTO snapshot_id;
  INSERT INTO retrieval_scope_sources (workspace_id, snapshot_id, source_version_id)
  SELECT sv.workspace_id, snapshot_id, sv.id FROM source_versions sv JOIN sources s
    ON s.workspace_id = sv.workspace_id AND s.id = sv.source_id
  WHERE sv.workspace_id = app.current_workspace_id() AND s.state = 'succeeded'
    AND (s.folder_id = p_folder_id OR (p_scope_mode = 'descendants' AND EXISTS (
      SELECT 1 FROM folder_closure fc WHERE fc.workspace_id = s.workspace_id
        AND fc.ancestor_id = p_folder_id AND fc.descendant_id = s.folder_id
    )));
  RETURN snapshot_id;
END $$;

CREATE OR REPLACE FUNCTION app.search_source_chunks(
  p_snapshot_id uuid, p_query text, p_limit integer DEFAULT 10
) RETURNS TABLE (
  chunk_id uuid, source_id uuid, source_version_id uuid, text_content text,
  structural_type text, locator jsonb, heading_path jsonb, rank real
)
LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, public, app AS $$
  SELECT c.id, sv.source_id, c.source_version_id, c.text_content, c.structural_type,
    c.locator, c.heading_path,
    ts_rank_cd(c.search_vector, plainto_tsquery('simple', p_query)) AS rank
  FROM source_chunks c
  JOIN source_versions sv ON sv.workspace_id = c.workspace_id AND sv.id = c.source_version_id
  JOIN retrieval_scope_sources rss ON rss.workspace_id = c.workspace_id AND rss.source_version_id = c.source_version_id
  JOIN retrieval_scope_snapshots rs ON rs.workspace_id = rss.workspace_id AND rs.id = rss.snapshot_id
  WHERE c.workspace_id = app.current_workspace_id() AND rs.id = p_snapshot_id
    AND app.active_workspace_member(c.workspace_id)
    AND nullif(trim(p_query), '') IS NOT NULL
    AND c.search_vector @@ plainto_tsquery('simple', p_query)
  ORDER BY rank DESC, c.source_version_id, c.ordinal
  LIMIT least(greatest(p_limit, 1), 50);
$$;

ALTER FUNCTION app.record_source_chunks(uuid, jsonb) OWNER TO cumulore_migration;
ALTER FUNCTION app.create_retrieval_scope_snapshot(uuid, retrieval_scope_mode) OWNER TO cumulore_migration;
ALTER FUNCTION app.search_source_chunks(uuid, text, integer) OWNER TO cumulore_migration;
REVOKE ALL ON FUNCTION app.record_source_chunks(uuid, jsonb), app.create_retrieval_scope_snapshot(uuid, retrieval_scope_mode), app.search_source_chunks(uuid, text, integer) FROM PUBLIC, cumulore_break_glass;
GRANT EXECUTE ON FUNCTION app.record_source_chunks(uuid, jsonb) TO cumulore_worker;
GRANT EXECUTE ON FUNCTION app.create_retrieval_scope_snapshot(uuid, retrieval_scope_mode), app.search_source_chunks(uuid, text, integer) TO cumulore_web;
GRANT USAGE ON TYPE retrieval_scope_mode TO cumulore_web;
ALTER TABLE source_chunks OWNER TO cumulore_migration;
ALTER TABLE retrieval_scope_snapshots OWNER TO cumulore_migration;
ALTER TABLE retrieval_scope_sources OWNER TO cumulore_migration;
RESET ROLE;
