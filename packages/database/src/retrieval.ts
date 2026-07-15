import type { Pool } from "pg";

import { withActorTransaction, type ActorContext } from "./index.js";

export type RetrievalScopeMode = "direct" | "descendants";

export type RetrievedChunk = {
  chunkId: string;
  sourceId: string;
  sourceVersionId: string;
  textContent: string;
  structuralType: string;
  locator: Record<string, string | number>;
  headingPath: string[];
  rank: number;
  keywordRank?: number;
  semanticRank?: number;
  combinedRank?: number;
};

export type RetrievalResult =
  | { kind: "evidence"; chunks: RetrievedChunk[] }
  | { kind: "insufficient_evidence"; reason: "no_authorized_match" };

export async function createRetrievalScopeSnapshot(
  pool: Pool,
  context: Required<ActorContext>,
  folderId: string,
  scopeMode: RetrievalScopeMode,
): Promise<string> {
  return withActorTransaction(pool, context, async (client) => {
    const result = await client.query<{ id: string }>(
      "SELECT app.create_retrieval_scope_snapshot($1, $2::retrieval_scope_mode) AS id",
      [folderId, scopeMode],
    );
    return result.rows[0]!.id;
  });
}

export async function searchSourceChunksHybrid(
  pool: Pool,
  context: Required<ActorContext>,
  snapshotId: string,
  query: string,
  queryEmbedding: readonly number[],
  embeddingModel: string,
  limit = 10,
): Promise<RetrievalResult> {
  return withActorTransaction(pool, context, async (client) => {
    const result = await client.query<RetrievedChunk>(
      'SELECT chunk_id AS "chunkId", source_id AS "sourceId", source_version_id AS "sourceVersionId", text_content AS "textContent", structural_type AS "structuralType", locator, heading_path AS "headingPath", keyword_rank AS "keywordRank", semantic_rank AS "semanticRank", combined_rank AS "combinedRank", combined_rank AS rank FROM app.search_source_chunks_hybrid($1, $2, $3::vector, $4, $5)',
      [
        snapshotId,
        query,
        `[${queryEmbedding.join(",")}]`,
        embeddingModel,
        limit,
      ],
    );
    if (result.rowCount === 0)
      return { kind: "insufficient_evidence", reason: "no_authorized_match" };
    return { kind: "evidence", chunks: result.rows };
  });
}

export async function searchSourceChunks(
  pool: Pool,
  context: Required<ActorContext>,
  snapshotId: string,
  query: string,
  limit = 10,
): Promise<RetrievalResult> {
  return withActorTransaction(pool, context, async (client) => {
    const result = await client.query<RetrievedChunk>(
      'SELECT chunk_id AS "chunkId", source_id AS "sourceId", source_version_id AS "sourceVersionId", text_content AS "textContent", structural_type AS "structuralType", locator, heading_path AS "headingPath", rank FROM app.search_source_chunks($1, $2, $3)',
      [snapshotId, query, limit],
    );
    if (result.rowCount === 0)
      return { kind: "insufficient_evidence", reason: "no_authorized_match" };
    return { kind: "evidence", chunks: result.rows };
  });
}
