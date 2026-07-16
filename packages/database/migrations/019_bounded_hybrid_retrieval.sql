SET LOCAL ROLE cumulore_migration;

CREATE OR REPLACE FUNCTION app.search_source_chunks_hybrid(
  p_snapshot_id uuid, p_query text, p_query_embedding vector(8), p_embedding_model text, p_limit integer DEFAULT 10
) RETURNS TABLE (
  chunk_id uuid, source_id uuid, source_version_id uuid, text_content text,
  structural_type text, locator jsonb, heading_path jsonb,
  keyword_rank real, semantic_rank real, combined_rank double precision
)
LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, public, app AS $$
  WITH keyword_candidates AS MATERIALIZED (
    SELECT c.id,
      ts_rank_cd(c.search_vector, plainto_tsquery('simple', p_query)) AS keyword_rank
    FROM source_chunks c
    JOIN retrieval_scope_sources rss
      ON rss.workspace_id = c.workspace_id AND rss.source_version_id = c.source_version_id
    JOIN retrieval_scope_snapshots rs
      ON rs.workspace_id = rss.workspace_id AND rs.id = rss.snapshot_id
    WHERE c.workspace_id = app.current_workspace_id()
      AND rs.id = p_snapshot_id
      AND rs.created_by_user_id = app.current_user_id()
      AND app.active_workspace_member(c.workspace_id)
      AND app.valid_source_locator(c.locator)
      AND nullif(trim(p_query), '') IS NOT NULL
      AND c.search_vector @@ plainto_tsquery('simple', p_query)
    ORDER BY keyword_rank DESC, c.source_version_id, c.ordinal
    LIMIT 50
  ), semantic_candidates AS MATERIALIZED (
    SELECT c.id, 1 - (embedding.embedding <=> p_query_embedding) AS semantic_rank
    FROM source_chunk_embeddings embedding
    JOIN source_chunks c
      ON c.workspace_id = embedding.workspace_id AND c.id = embedding.chunk_id
    JOIN retrieval_scope_sources rss
      ON rss.workspace_id = c.workspace_id AND rss.source_version_id = c.source_version_id
    JOIN retrieval_scope_snapshots rs
      ON rs.workspace_id = rss.workspace_id AND rs.id = rss.snapshot_id
    WHERE embedding.workspace_id = app.current_workspace_id()
      AND embedding.embedding_model = p_embedding_model
      AND rs.id = p_snapshot_id
      AND rs.created_by_user_id = app.current_user_id()
      AND app.active_workspace_member(embedding.workspace_id)
      AND app.valid_source_locator(c.locator)
      AND p_query_embedding IS NOT NULL
    ORDER BY embedding.embedding <=> p_query_embedding, c.source_version_id, c.ordinal
    LIMIT 50
  ), candidate_ids AS MATERIALIZED (
    SELECT id FROM keyword_candidates
    UNION
    SELECT id FROM semantic_candidates
  )
  SELECT c.id, source_version.source_id, c.source_version_id, c.text_content,
    c.structural_type, c.locator, c.heading_path,
    coalesce(keyword.keyword_rank, 0::real),
    coalesce(semantic.semantic_rank, 0::double precision)::real,
    (
      0.5 * greatest(coalesce(keyword.keyword_rank, 0::real), 0)
      + 0.5 * greatest(coalesce(semantic.semantic_rank, 0::double precision), 0)
    ) AS combined_rank
  FROM candidate_ids candidate
  JOIN source_chunks c ON c.id = candidate.id AND c.workspace_id = app.current_workspace_id()
  JOIN source_versions source_version
    ON source_version.workspace_id = c.workspace_id AND source_version.id = c.source_version_id
  LEFT JOIN keyword_candidates keyword ON keyword.id = c.id
  LEFT JOIN semantic_candidates semantic ON semantic.id = c.id
  ORDER BY combined_rank DESC, c.source_version_id, c.ordinal
  LIMIT least(greatest(p_limit, 1), 50);
$$;

ALTER FUNCTION app.search_source_chunks_hybrid(uuid, text, vector, text, integer)
  OWNER TO cumulore_migration;
REVOKE ALL ON FUNCTION app.search_source_chunks_hybrid(uuid, text, vector, text, integer)
  FROM PUBLIC, cumulore_worker, cumulore_break_glass;
GRANT EXECUTE ON FUNCTION app.search_source_chunks_hybrid(uuid, text, vector, text, integer)
  TO cumulore_web;

RESET ROLE;
