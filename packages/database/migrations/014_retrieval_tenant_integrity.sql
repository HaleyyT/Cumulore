SET LOCAL ROLE cumulore_migration;

ALTER TABLE source_chunks
  ADD CONSTRAINT source_chunks_workspace_id_id_key UNIQUE (workspace_id, id);

ALTER TABLE source_chunk_embeddings
  DROP CONSTRAINT source_chunk_embeddings_chunk_id_fkey;

ALTER TABLE source_chunk_embeddings
  ADD CONSTRAINT source_chunk_embeddings_workspace_chunk_fkey
  FOREIGN KEY (workspace_id, chunk_id)
  REFERENCES source_chunks(workspace_id, id)
  ON DELETE CASCADE
  NOT VALID;

ALTER TABLE source_chunk_embeddings
  VALIDATE CONSTRAINT source_chunk_embeddings_workspace_chunk_fkey;

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
    AND rs.created_by_user_id = app.current_user_id()
    AND app.active_workspace_member(c.workspace_id)
    AND nullif(trim(p_query), '') IS NOT NULL
    AND c.search_vector @@ plainto_tsquery('simple', p_query)
  ORDER BY rank DESC, c.source_version_id, c.ordinal
  LIMIT least(greatest(p_limit, 1), 50);
$$;

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
      AND rs.created_by_user_id = app.current_user_id()
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

ALTER FUNCTION app.search_source_chunks(uuid, text, integer) OWNER TO cumulore_migration;
ALTER FUNCTION app.search_source_chunks_hybrid(uuid, text, vector, text, integer) OWNER TO cumulore_migration;
REVOKE ALL ON FUNCTION app.search_source_chunks(uuid, text, integer), app.search_source_chunks_hybrid(uuid, text, vector, text, integer)
  FROM PUBLIC, cumulore_worker, cumulore_break_glass;
GRANT EXECUTE ON FUNCTION app.search_source_chunks(uuid, text, integer), app.search_source_chunks_hybrid(uuid, text, vector, text, integer)
  TO cumulore_web;

RESET ROLE;
