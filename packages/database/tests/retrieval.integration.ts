import assert from "node:assert/strict";
import type { QueryResultRow } from "pg";

import {
  createFolder,
  createPool,
  createRetrievalScopeSnapshot,
  createUploadSession,
  createWorkspace,
  finalizeUpload,
  provisionIdentity,
  searchSourceChunks,
  searchSourceChunksHybrid,
} from "../src/index.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString)
  throw new Error("DATABASE_URL is required for integration tests");
const pool = createPool(connectionString);

async function workerCall<T extends QueryResultRow>(
  workspaceId: string,
  query: string,
  values: unknown[],
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL ROLE cumulore_worker");
    await client.query("SELECT set_config('app.workspace_id', $1, true)", [
      workspaceId,
    ]);
    const result = await client.query<T>(query, values);
    await client.query("COMMIT");
    return result.rows[0]!;
  } finally {
    client.release();
  }
}

try {
  const user = await provisionIdentity(pool, {
    issuer: "https://fake.identity.local/",
    subject: `retrieval-${Date.now()}`,
  });
  const workspace = await createWorkspace(pool, user, "Retrieval workspace");
  const folder = await createFolder(
    pool,
    { userId: user, workspaceId: workspace },
    "Evidence",
  );
  const upload = await createUploadSession(
    pool,
    { userId: user, workspaceId: workspace },
    {
      folderId: folder,
      title: "retrieval.txt",
      format: "txt",
      contentType: "text/plain",
      byteSize: 8,
      expiresAt: new Date(Date.now() + 15 * 60_000),
    },
  );
  const sourceId = await finalizeUpload(
    pool,
    { userId: user, workspaceId: workspace },
    {
      uploadSessionId: upload.uploadSessionId,
      byteSize: 8,
      sha256: Buffer.alloc(32, 3),
    },
  );
  await workerCall(workspace, "SELECT app.record_source_validation($1, $2)", [
    sourceId,
    Buffer.alloc(32, 3),
  ]);
  await workerCall(
    workspace,
    "SELECT app.record_source_extraction($1, $2, $3, $4)",
    [
      sourceId,
      "cumulore-text-1",
      { element_count: 1 },
      JSON.stringify([
        {
          kind: "paragraph",
          text: "PostgreSQL retrieval evidence",
          locator: { line: 1 },
        },
      ]),
    ],
  );
  const chunks = await workerCall<{ record_source_chunks: number }>(
    workspace,
    "SELECT app.record_source_chunks($1, $2) AS record_source_chunks",
    [
      sourceId,
      JSON.stringify([
        {
          kind: "paragraph",
          text: "PostgreSQL retrieval evidence",
          locator: { line: 1 },
          heading_path: ["Evidence"],
        },
      ]),
    ],
  );
  assert.equal(chunks.record_source_chunks, 1);

  const snapshot = await createRetrievalScopeSnapshot(
    pool,
    { userId: user, workspaceId: workspace },
    folder,
    "direct",
  );
  const context = { userId: user, workspaceId: workspace };
  const evidence = await searchSourceChunks(
    pool,
    context,
    snapshot,
    "retrieval evidence",
  );
  assert.equal(evidence.kind, "evidence");
  if (evidence.kind === "evidence")
    assert.equal(evidence.chunks[0]!.locator.line, 1);
  assert.deepEqual(
    await searchSourceChunks(pool, context, snapshot, "not present"),
    {
      kind: "insufficient_evidence",
      reason: "no_authorized_match",
    },
  );
  const chunk = await pool.query<{ id: string }>(
    "SELECT id FROM source_chunks WHERE source_version_id = $1",
    [upload.sourceVersionId],
  );
  await workerCall(
    workspace,
    "SELECT app.record_source_chunk_embeddings($1, $2, $3)",
    [
      sourceId,
      "synthetic-hash-8-v1",
      JSON.stringify([
        {
          chunk_id: chunk.rows[0]!.id,
          embedding: "[1,0,0,0,0,0,0,0]",
        },
      ]),
    ],
  );
  const hybrid = await searchSourceChunksHybrid(
    pool,
    context,
    snapshot,
    "retrieval evidence",
    [1, 0, 0, 0, 0, 0, 0, 0],
    "synthetic-hash-8-v1",
  );
  assert.equal(hybrid.kind, "evidence");
  if (hybrid.kind === "evidence")
    assert.ok((hybrid.chunks[0]!.combinedRank ?? 0) > 0);
  console.log("PostgreSQL retrieval integration tests passed.");
} finally {
  await pool.end();
}
