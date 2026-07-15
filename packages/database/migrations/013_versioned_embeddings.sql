SET LOCAL ROLE cumulore_migration;

CREATE TABLE source_chunk_embeddings (
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  chunk_id uuid NOT NULL,
  embedding_model text NOT NULL CHECK (embedding_model ~ '^[a-z0-9_.:-]{1,120}$'),
  embedding vector(8) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, chunk_id, embedding_model),
  FOREIGN KEY (chunk_id) REFERENCES source_chunks(id) ON DELETE CASCADE
);

CREATE INDEX source_chunk_embeddings_cosine_idx ON source_chunk_embeddings
  USING hnsw (embedding vector_cosine_ops);

ALTER TABLE source_chunk_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_chunk_embeddings FORCE ROW LEVEL SECURITY;
CREATE POLICY source_chunk_embeddings_web_read ON source_chunk_embeddings FOR SELECT TO cumulore_web
  USING (workspace_id = app.current_workspace_id() AND app.active_workspace_member(workspace_id));
CREATE POLICY source_chunk_embeddings_migration ON source_chunk_embeddings FOR ALL TO cumulore_migration USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION app.record_source_chunk_embeddings(
  p_source_id uuid, p_embedding_model text, p_embeddings jsonb
) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, app AS $$
DECLARE item jsonb; chunk_id_value uuid; inserted_count integer := 0;
BEGIN
  IF jsonb_typeof(p_embeddings) <> 'array' OR jsonb_array_length(p_embeddings) = 0 THEN
    RAISE EXCEPTION 'embedding list must be a non-empty array' USING ERRCODE = '22023';
  END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(p_embeddings) LOOP
    chunk_id_value := (item->>'chunk_id')::uuid;
    INSERT INTO source_chunk_embeddings (workspace_id, chunk_id, embedding_model, embedding)
    SELECT app.current_workspace_id(), c.id, p_embedding_model, (item->>'embedding')::vector
    FROM source_chunks c JOIN source_versions sv ON sv.workspace_id = c.workspace_id AND sv.id = c.source_version_id
    WHERE c.id = chunk_id_value AND c.workspace_id = app.current_workspace_id() AND sv.source_id = p_source_id
    ON CONFLICT (workspace_id, chunk_id, embedding_model) DO UPDATE
      SET embedding = EXCLUDED.embedding, created_at = clock_timestamp();
    IF FOUND THEN inserted_count := inserted_count + 1; END IF;
  END LOOP;
  RETURN inserted_count;
END $$;

CREATE OR REPLACE FUNCTION app.search_source_chunks_hybrid(
  p_snapshot_id uuid, p_query text, p_query_embedding vector(8), p_embedding_model text, p_limit integer DEFAULT 10
) RETURNS TABLE (
  chunk_id uuid, source_id uuid, source_version_id uuid, text_content text,
  structural_type text, locator jsonb, heading_path jsonb,
  keyword_rank real, semantic_rank real, combined_rank double precision
)
LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, public, app AS $$
  WITH candidates AS (
    SELECT c.*, sv.source_id,
      ts_rank_cd(c.search_vector, plainto_tsquery('simple', p_query)) AS keyword_rank,
      1 - (e.embedding <=> p_query_embedding) AS semantic_rank
    FROM source_chunks c
    JOIN source_versions sv ON sv.workspace_id = c.workspace_id AND sv.id = c.source_version_id
    JOIN retrieval_scope_sources rss ON rss.workspace_id = c.workspace_id AND rss.source_version_id = c.source_version_id
    JOIN retrieval_scope_snapshots rs ON rs.workspace_id = rss.workspace_id AND rs.id = rss.snapshot_id
    JOIN source_chunk_embeddings e ON e.workspace_id = c.workspace_id AND e.chunk_id = c.id AND e.embedding_model = p_embedding_model
    WHERE c.workspace_id = app.current_workspace_id() AND rs.id = p_snapshot_id
      AND app.active_workspace_member(c.workspace_id)
      AND (c.search_vector @@ plainto_tsquery('simple', p_query) OR p_query_embedding IS NOT NULL)
  )
  SELECT id, source_id, source_version_id, text_content, structural_type, locator, heading_path,
    keyword_rank, semantic_rank, (0.5 * greatest(keyword_rank, 0) + 0.5 * greatest(semantic_rank, 0))
  FROM candidates
  ORDER BY (0.5 * greatest(keyword_rank, 0) + 0.5 * greatest(semantic_rank, 0)) DESC,
    source_version_id, id
  LIMIT least(greatest(p_limit, 1), 50);
$$;

ALTER FUNCTION app.record_source_chunk_embeddings(uuid, text, jsonb) OWNER TO cumulore_migration;
ALTER FUNCTION app.search_source_chunks_hybrid(uuid, text, vector, text, integer) OWNER TO cumulore_migration;
REVOKE ALL ON FUNCTION app.record_source_chunk_embeddings(uuid, text, jsonb), app.search_source_chunks_hybrid(uuid, text, vector, text, integer) FROM PUBLIC, cumulore_break_glass;
GRANT EXECUTE ON FUNCTION app.record_source_chunk_embeddings(uuid, text, jsonb) TO cumulore_worker;
GRANT EXECUTE ON FUNCTION app.search_source_chunks_hybrid(uuid, text, vector, text, integer) TO cumulore_web;
ALTER TABLE source_chunk_embeddings OWNER TO cumulore_migration;
RESET ROLE;
