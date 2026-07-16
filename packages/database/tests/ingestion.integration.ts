import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { QueryResultRow } from "pg";

import {
  createFolder,
  createPool,
  createUploadSession,
  createWorkspace,
  finalizeUpload,
  provisionIdentity,
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
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

try {
  const user = await provisionIdentity(pool, {
    issuer: "https://fake.identity.local/",
    subject: `ingestion-${Date.now()}`,
  });
  const workspace = await createWorkspace(pool, user, "Ingestion workspace");
  const folder = await createFolder(
    pool,
    { userId: user, workspaceId: workspace },
    "Course files",
  );
  const first = await createUploadSession(
    pool,
    { userId: user, workspaceId: workspace },
    {
      folderId: folder,
      title: "week-one.txt",
      format: "txt",
      contentType: "text/plain",
      byteSize: 12,
      expiresAt: new Date(Date.now() + 15 * 60_000),
    },
  );
  assert.match(first.quarantineKey, new RegExp(`^quarantine/${workspace}/`));
  const correlationId = randomUUID();
  const sourceId = await finalizeUpload(
    pool,
    { userId: user, workspaceId: workspace },
    {
      uploadSessionId: first.uploadSessionId,
      byteSize: 12,
      sha256: Buffer.alloc(32, 7),
      correlationId,
    },
  );
  const finalizedEvent = await pool.query<{
    correlation_id: string;
    causation_id: string | null;
  }>(
    "SELECT correlation_id, causation_id FROM outbox_events WHERE workspace_id = $1 AND event_type = 'source.upload.finalized' AND payload->>'source_id' = $2",
    [workspace, sourceId],
  );
  assert.deepEqual(finalizedEvent.rows, [
    { correlation_id: correlationId, causation_id: null },
  ]);
  const state = await workerCall<{ record_source_validation: string }>(
    workspace,
    "SELECT app.record_source_validation($1, $2) AS record_source_validation",
    [sourceId, Buffer.alloc(32, 7)],
  );
  assert.equal(state.record_source_validation, "extracting");
  const recorded = await workerCall<{ record_source_extraction: boolean }>(
    workspace,
    "SELECT app.record_source_extraction($1, $2, $3, $4) AS record_source_extraction",
    [
      sourceId,
      "cumulore-text-1",
      { element_count: 1 },
      JSON.stringify([
        {
          kind: "paragraph",
          text: "hello",
          locator: {
            locator_version: 1,
            format: "txt",
            segments: [{ kind: "line", index: 1 }],
          },
        },
      ]),
    ],
  );
  assert.equal(recorded.record_source_extraction, true);
  const source = await pool.query<{ state: string; element_count: string }>(
    "SELECT s.state, (SELECT count(*) FROM extraction_elements e WHERE e.source_version_id = sv.id) AS element_count FROM sources s JOIN source_versions sv ON sv.source_id = s.id WHERE s.id = $1",
    [sourceId],
  );
  assert.deepEqual(source.rows[0], { state: "succeeded", element_count: "1" });

  const duplicate = await createUploadSession(
    pool,
    { userId: user, workspaceId: workspace },
    {
      folderId: folder,
      title: "copy.txt",
      format: "txt",
      contentType: "text/plain",
      byteSize: 12,
      expiresAt: new Date(Date.now() + 15 * 60_000),
    },
  );
  const duplicateId = await finalizeUpload(
    pool,
    { userId: user, workspaceId: workspace },
    {
      uploadSessionId: duplicate.uploadSessionId,
      byteSize: 12,
      sha256: Buffer.alloc(32, 7),
    },
  );
  const duplicateState = await workerCall<{ record_source_validation: string }>(
    workspace,
    "SELECT app.record_source_validation($1, $2) AS record_source_validation",
    [duplicateId, Buffer.alloc(32, 7)],
  );
  assert.equal(
    duplicateState.record_source_validation,
    "duplicate_confirmation_required",
  );
  console.log("PostgreSQL ingestion integration tests passed.");
} finally {
  await pool.end();
}
