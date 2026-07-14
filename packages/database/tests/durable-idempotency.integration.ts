import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";

import {
  canonicalRequestHash,
  createPool,
  createWorkspace,
  provisionIdentity,
  requestSyntheticOperation,
} from "../src/index.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString)
  throw new Error("DATABASE_URL is required for integration tests");
const pool = createPool(connectionString);

async function tx<T>(
  role: "cumulore_migration" | "cumulore_web" | "cumulore_worker",
  action: (client: PoolClient) => Promise<T>,
  context?: { userId?: string; workspaceId?: string },
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SET LOCAL ROLE ${role}`);
    if (context?.userId)
      await client.query("SELECT set_config('app.user_id', $1, true)", [
        context.userId,
      ]);
    if (context?.workspaceId)
      await client.query("SELECT set_config('app.workspace_id', $1, true)", [
        context.workspaceId,
      ]);
    const result = await action(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function createJob(userId: string, workspaceId: string): Promise<string> {
  const result = await requestSyntheticOperation(
    pool,
    { userId, workspaceId },
    randomUUID(),
    {
      scenario: "database_effect",
      inputVersion: 1,
      configurationVersion: 1,
      correlationId: randomUUID(),
    },
  );
  assert.equal(result.kind, "executed");
  return result.response.operationId;
}

try {
  assert.deepEqual(
    canonicalRequestHash({ b: 2, a: [1, 2] }),
    canonicalRequestHash({ a: [1, 2], b: 2 }),
  );
  assert.notDeepEqual(
    canonicalRequestHash({ a: [1, 2] }),
    canonicalRequestHash({ a: [2, 1] }),
  );
  assert.throws(() => canonicalRequestHash({ value: Number.NaN }));

  await tx("cumulore_migration", (client) =>
    client.query(
      `TRUNCATE endpoint_idempotency_records, external_operations, job_effects,
       job_actions, job_attempts, jobs, outbox_events, synthetic_operations,
       event_handlers, folder_closure, folders, workspace_members, workspaces,
       external_identities, users CASCADE`,
    ),
  );
  await tx("cumulore_migration", (client) =>
    client.query(
      `INSERT INTO event_handlers (event_type, schema_version, handler_name, handler_version, requires_workspace)
       VALUES ('durable.synthetic.requested', 1, 'run_synthetic', 1, true)`,
    ),
  );
  const userId = await provisionIdentity(pool, {
    issuer: "https://fake.identity.local/",
    subject: `idempotency-${randomUUID()}`,
  });
  const workspaceId = await createWorkspace(pool, userId, "Idempotency");
  const request = {
    scenario: "database_effect" as const,
    inputVersion: 1,
    configurationVersion: 1,
    correlationId: randomUUID(),
  };
  const first = await requestSyntheticOperation(
    pool,
    { userId, workspaceId },
    "same-key",
    request,
  );
  const replay = await requestSyntheticOperation(
    pool,
    { userId, workspaceId },
    "same-key",
    request,
  );
  assert.equal(first.kind, "executed");
  assert.equal(replay.kind, "replayed");
  assert.deepEqual(replay.response, first.response);
  await assert.rejects(() =>
    requestSyntheticOperation(pool, { userId, workspaceId }, "same-key", {
      ...request,
      inputVersion: 2,
    }),
  );
  assert.equal(
    (await pool.query("SELECT count(*) FROM synthetic_operations")).rows[0]
      .count,
    "1",
  );

  if (first.kind !== "executed")
    throw new Error("first idempotent request did not execute");
  const operationId = first.response.operationId;
  await tx("cumulore_worker", (client) =>
    client.query("SELECT app.dispatch_outbox(10)"),
  );
  const claimed = await tx(
    "cumulore_worker",
    (client) =>
      client.query<{
        job_id: string;
        attempt_id: string;
        lease_generation: string;
      }>(
        "SELECT job_id, attempt_id, lease_generation FROM app.claim_jobs($1, 1, 60)",
        ["effect-worker"],
      ),
    { workspaceId },
  );
  assert.equal(claimed.rowCount, 1);
  const job = claimed.rows[0]!;
  const operationRow = await pool.query<{ id: string }>(
    "SELECT id FROM jobs WHERE event_id IN (SELECT id FROM outbox_events WHERE payload->>'synthetic_operation_id' = $1)",
    [operationId],
  );
  assert.equal(operationRow.rows[0]!.id, job.job_id);
  const effectResult = await tx(
    "cumulore_worker",
    (client) =>
      client.query<{ complete_job_with_effect: boolean }>(
        "SELECT app.complete_job_with_effect($1, $2, $3, $4, 'synthetic.write', 'database', 1, 1, '{\"ok\":true}'::jsonb)",
        [job.job_id, job.attempt_id, "effect-worker", job.lease_generation],
      ),
    { workspaceId },
  );
  assert.equal(effectResult.rows[0]!.complete_job_with_effect, true);
  assert.equal(
    (await pool.query("SELECT count(*) FROM job_effects")).rows[0].count,
    "1",
  );

  await createJob(userId, workspaceId);
  await tx("cumulore_worker", (client) =>
    client.query("SELECT app.dispatch_outbox(10)"),
  );
  const externalClaim = await tx(
    "cumulore_worker",
    (client) =>
      client.query<{
        job_id: string;
        attempt_id: string;
        lease_generation: string;
      }>(
        "SELECT job_id, attempt_id, lease_generation FROM app.claim_jobs($1, 1, 60)",
        ["external-worker"],
      ),
    { workspaceId },
  );
  const externalJob = externalClaim.rows[0]!;
  const logicalId = randomUUID();
  const requestHash = createHash("sha256").update("external-request").digest();
  const prepared = await tx(
    "cumulore_worker",
    (client) =>
      client.query<{ prepare_external_operation: string }>(
        "SELECT app.prepare_external_operation($1,$2,$3,$4,$5,0,NULL,NULL,'fake','invoke','provider-key',$6)",
        [
          externalJob.job_id,
          externalJob.attempt_id,
          "external-worker",
          externalJob.lease_generation,
          logicalId,
          requestHash,
        ],
      ),
    { workspaceId },
  );
  const externalId = prepared.rows[0]!.prepare_external_operation;
  assert.ok(externalId);
  await tx(
    "cumulore_worker",
    (client) =>
      client.query("SELECT app.mark_external_in_flight($1,$2,$3,$4,$5)", [
        externalId,
        externalJob.job_id,
        externalJob.attempt_id,
        "external-worker",
        externalJob.lease_generation,
      ]),
    { workspaceId },
  );
  await tx(
    "cumulore_worker",
    (client) =>
      client.query(
        "SELECT app.record_external_result($1,$2,$3,$4,$5,'unknown',NULL,NULL,clock_timestamp() - interval '1 second')",
        [
          externalId,
          externalJob.job_id,
          externalJob.attempt_id,
          "external-worker",
          externalJob.lease_generation,
        ],
      ),
    { workspaceId },
  );
  const reconciliation = await tx(
    "cumulore_worker",
    (client) =>
      client.query<{ operation_id: string; reconciliation_generation: string }>(
        "SELECT operation_id, reconciliation_generation FROM app.claim_external_reconciliation($1,1,60)",
        ["reconcile-worker"],
      ),
    { workspaceId },
  );
  assert.equal(reconciliation.rows[0]!.operation_id, externalId);
  const resolved = await tx(
    "cumulore_worker",
    (client) =>
      client.query<{ resolve_external_reconciliation: boolean }>(
        "SELECT app.resolve_external_reconciliation($1,$2,$3,true,'provider-ref',NULL)",
        [
          externalId,
          "reconcile-worker",
          reconciliation.rows[0]!.reconciliation_generation,
        ],
      ),
    { workspaceId },
  );
  assert.equal(resolved.rows[0]!.resolve_external_reconciliation, true);
  assert.equal(
    (
      await pool.query("SELECT state FROM external_operations WHERE id = $1", [
        externalId,
      ])
    ).rows[0].state,
    "succeeded",
  );

  await tx("cumulore_migration", (client) =>
    client.query(
      "TRUNCATE endpoint_idempotency_records, external_operations, job_effects, job_actions, job_attempts, jobs, outbox_events, synthetic_operations, event_handlers, folder_closure, folders, workspace_members, workspaces, external_identities, users CASCADE",
    ),
  );
  await tx("cumulore_migration", (client) =>
    client.query(
      `INSERT INTO event_handlers (event_type, schema_version, handler_name, handler_version, requires_workspace)
       VALUES ('durable.synthetic.requested', 1, 'run_synthetic', 1, true)`,
    ),
  );
  await pool.end();
  console.log(
    "Durable idempotency and external-operation integration tests passed.",
  );
} catch (error) {
  await pool.end();
  throw error;
}
