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

async function createJob(
  userId: string,
  workspaceId: string,
  scenario: "database_effect" | "external_success" = "database_effect",
): Promise<string> {
  const result = await requestSyntheticOperation(
    pool,
    { userId, workspaceId },
    randomUUID(),
    {
      scenario,
      inputVersion: 1,
      configurationVersion: 1,
      correlationId: randomUUID(),
    },
  );
  assert.equal(result.kind, "executed");
  return result.response.operationId;
}

type DurableClaim = {
  job_id: string;
  attempt_id: string;
  lease_generation: string;
};

async function createAndClaimJob(
  userId: string,
  workspaceId: string,
  owner: string,
): Promise<{ logicalOperationId: string; claim: DurableClaim }> {
  const logicalOperationId = await createJob(userId, workspaceId);
  await tx("cumulore_worker", (client) =>
    client.query("SELECT app.dispatch_outbox(10)"),
  );
  const claimed = await tx(
    "cumulore_worker",
    (client) =>
      client.query<DurableClaim>(
        "SELECT job_id, attempt_id, lease_generation FROM app.claim_jobs($1,1,60)",
        [owner],
      ),
    { workspaceId },
  );
  assert.equal(claimed.rowCount, 1);
  return { logicalOperationId, claim: claimed.rows[0]! };
}

async function prepareExternalOperation(
  workspaceId: string,
  owner: string,
  logicalOperationId: string,
  claim: DurableClaim,
): Promise<string> {
  const prepared = await tx(
    "cumulore_worker",
    (client) =>
      client.query<{ operation_id: string }>(
        "SELECT app.prepare_external_operation($1,$2,$3,$4,$5,0,NULL,NULL,'fake','invoke',$6,$7) AS operation_id",
        [
          claim.job_id,
          claim.attempt_id,
          owner,
          claim.lease_generation,
          logicalOperationId,
          `recovery:${logicalOperationId}`,
          createHash("sha256").update(logicalOperationId).digest(),
        ],
      ),
    { workspaceId },
  );
  return prepared.rows[0]!.operation_id;
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

  const externalLogicalId = await createJob(userId, workspaceId);
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
  const logicalId = externalLogicalId;
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
  const foreignUserId = await provisionIdentity(pool, {
    issuer: "https://fake.identity.local/",
    subject: `reconciliation-foreign-${randomUUID()}`,
  });
  const foreignWorkspaceId = await createWorkspace(
    pool,
    foreignUserId,
    "Foreign reconciliation",
  );
  const foreignJob = await createAndClaimJob(
    foreignUserId,
    foreignWorkspaceId,
    "foreign-external-worker",
  );
  const foreignExternalId = await prepareExternalOperation(
    foreignWorkspaceId,
    "foreign-external-worker",
    foreignJob.logicalOperationId,
    foreignJob.claim,
  );
  await tx(
    "cumulore_worker",
    (client) =>
      client.query("SELECT app.mark_external_in_flight($1,$2,$3,$4,$5)", [
        foreignExternalId,
        foreignJob.claim.job_id,
        foreignJob.claim.attempt_id,
        "foreign-external-worker",
        foreignJob.claim.lease_generation,
      ]),
    { workspaceId: foreignWorkspaceId },
  );
  await tx(
    "cumulore_worker",
    (client) =>
      client.query(
        "SELECT app.record_external_result($1,$2,$3,$4,$5,'unknown',NULL,NULL,clock_timestamp() - interval '1 second')",
        [
          foreignExternalId,
          foreignJob.claim.job_id,
          foreignJob.claim.attempt_id,
          "foreign-external-worker",
          foreignJob.claim.lease_generation,
        ],
      ),
    { workspaceId: foreignWorkspaceId },
  );
  const reconciliation = await tx("cumulore_worker", (client) =>
    client.query<{
      operation_id: string;
      workspace_id: string;
      reconciliation_generation: string;
    }>(
      "SELECT operation_id, workspace_id, reconciliation_generation FROM app.claim_external_reconciliation($1,2,60)",
      ["reconcile-worker"],
    ),
  );
  assert.deepEqual(
    new Set(
      reconciliation.rows.map(
        (row) => `${row.workspace_id}:${row.operation_id}`,
      ),
    ),
    new Set([
      `${workspaceId}:${externalId}`,
      `${foreignWorkspaceId}:${foreignExternalId}`,
    ]),
    "the narrow claim returns authoritative workspace context across tenants",
  );
  const targetReconciliation = reconciliation.rows.find(
    (row) => row.operation_id === externalId,
  )!;
  const foreignReconciliation = reconciliation.rows.find(
    (row) => row.operation_id === foreignExternalId,
  )!;
  const competingReconciliation = await tx("cumulore_worker", (client) =>
    client.query(
      "SELECT operation_id FROM app.claim_external_reconciliation($1,1,60)",
      ["competing-reconcile-worker"],
    ),
  );
  assert.equal(
    competingReconciliation.rowCount,
    0,
    "an active reconciliation lease prevents duplicate claims",
  );
  const staleReconciliation = await tx(
    "cumulore_worker",
    (client) =>
      client.query<{ resolve_external_reconciliation: boolean }>(
        "SELECT app.resolve_external_reconciliation($1,$2,$3,true,'stale-ref',NULL)",
        [
          externalId,
          "reconcile-worker",
          Number(targetReconciliation.reconciliation_generation) - 1,
        ],
      ),
    { workspaceId },
  );
  assert.equal(
    staleReconciliation.rows[0]!.resolve_external_reconciliation,
    false,
    "a stale reconciliation generation cannot publish a result",
  );
  const resolved = await tx(
    "cumulore_worker",
    (client) =>
      client.query<{ resolve_external_reconciliation: boolean }>(
        "SELECT app.resolve_external_reconciliation($1,$2,$3,true,'provider-ref',NULL)",
        [
          externalId,
          "reconcile-worker",
          targetReconciliation.reconciliation_generation,
        ],
      ),
    { workspaceId },
  );
  assert.equal(resolved.rows[0]!.resolve_external_reconciliation, true);
  const foreignResolved = await tx(
    "cumulore_worker",
    (client) =>
      client.query<{ resolve_external_reconciliation: boolean }>(
        "SELECT app.resolve_external_reconciliation($1,$2,$3,true,'foreign-provider-ref',NULL)",
        [
          foreignExternalId,
          "reconcile-worker",
          foreignReconciliation.reconciliation_generation,
        ],
      ),
    { workspaceId: foreignWorkspaceId },
  );
  assert.equal(foreignResolved.rows[0]!.resolve_external_reconciliation, true);
  assert.equal(
    (
      await pool.query("SELECT state FROM external_operations WHERE id = $1", [
        externalId,
      ])
    ).rows[0].state,
    "succeeded",
  );
  const retryWait = await tx(
    "cumulore_worker",
    (client) =>
      client.query<{ fail_job: boolean }>(
        "SELECT app.fail_job($1,$2,$3,$4,true,'external_outcome_pending')",
        [
          externalJob.job_id,
          externalJob.attempt_id,
          "external-worker",
          externalJob.lease_generation,
        ],
      ),
    { workspaceId },
  );
  assert.equal(retryWait.rows[0]!.fail_job, true);
  const resumed = await tx(
    "cumulore_worker",
    (client) =>
      client.query<{
        job_id: string;
        attempt_id: string;
        lease_generation: string;
      }>(
        "SELECT job_id, attempt_id, lease_generation FROM app.claim_jobs($1,1,60)",
        ["resumed-worker"],
      ),
    { workspaceId },
  );
  assert.equal(resumed.rowCount, 1);
  const resumedJob = resumed.rows[0]!;
  assert.equal(
    resumedJob.job_id,
    externalJob.job_id,
    "the retried claim must resume the original external-operation job",
  );
  const completionEvidence = await pool.query<{ present: boolean }>(
    `SELECT EXISTS (
       SELECT 1
       FROM external_operations operation
       JOIN jobs job
         ON job.workspace_id = operation.workspace_id
        AND job.id = operation.job_id
       JOIN outbox_events event
         ON event.workspace_id = operation.workspace_id
        AND event.id = job.event_id
       WHERE operation.workspace_id = $1
         AND operation.job_id = $2
         AND operation.logical_operation_id = $3
         AND operation.provider_name = 'fake'
         AND operation.operation_name = 'invoke'
         AND operation.state = 'succeeded'
         AND event.event_type = 'durable.synthetic.requested'
         AND event.schema_version = 1
         AND event.payload->>'synthetic_operation_id' = $3::text
     ) AS present`,
    [workspaceId, resumedJob.job_id, logicalId],
  );
  assert.equal(
    completionEvidence.rows[0]!.present,
    true,
    "a reconciled fake invocation must remain authoritative completion evidence",
  );
  const staleCompletion = await tx(
    "cumulore_worker",
    (client) =>
      client.query<{ complete_job_from_external_operation: boolean }>(
        "SELECT app.complete_job_from_external_operation($1,$2,$3,$4,$5)",
        [
          resumedJob.job_id,
          resumedJob.attempt_id,
          "resumed-worker",
          Number(resumedJob.lease_generation) - 1,
          logicalId,
        ],
      ),
    { workspaceId },
  );
  assert.equal(
    staleCompletion.rows[0]!.complete_job_from_external_operation,
    false,
  );
  const completed = await tx(
    "cumulore_worker",
    (client) =>
      client.query<{ complete_job_from_external_operation: boolean }>(
        "SELECT app.complete_job_from_external_operation($1,$2,$3,$4,$5)",
        [
          resumedJob.job_id,
          resumedJob.attempt_id,
          "resumed-worker",
          resumedJob.lease_generation,
          logicalId,
        ],
      ),
    { workspaceId },
  );
  assert.equal(completed.rows[0]!.complete_job_from_external_operation, true);
  assert.equal(
    (
      await pool.query("SELECT state FROM jobs WHERE id = $1", [
        externalJob.job_id,
      ])
    ).rows[0].state,
    "succeeded",
  );

  const cancelledAfterExternalLogicalId = await createJob(
    userId,
    workspaceId,
    "external_success",
  );
  await tx("cumulore_worker", (client) =>
    client.query("SELECT app.dispatch_outbox(10)"),
  );
  const cancelledAfterExternalClaim = await tx(
    "cumulore_worker",
    (client) =>
      client.query<DurableClaim>(
        "SELECT job_id, attempt_id, lease_generation FROM app.claim_jobs($1,1,60)",
        ["external-cancellation-worker"],
      ),
    { workspaceId },
  );
  const cancelledAfterExternalJob = cancelledAfterExternalClaim.rows[0]!;
  const cancelledAfterExternalOperation = await prepareExternalOperation(
    workspaceId,
    "external-cancellation-worker",
    cancelledAfterExternalLogicalId,
    cancelledAfterExternalJob,
  );
  await tx(
    "cumulore_worker",
    (client) =>
      client.query("SELECT app.mark_external_in_flight($1,$2,$3,$4,$5)", [
        cancelledAfterExternalOperation,
        cancelledAfterExternalJob.job_id,
        cancelledAfterExternalJob.attempt_id,
        "external-cancellation-worker",
        cancelledAfterExternalJob.lease_generation,
      ]),
    { workspaceId },
  );
  await tx(
    "cumulore_worker",
    (client) =>
      client.query(
        "SELECT app.record_external_result($1,$2,$3,$4,$5,'succeeded','provider-cancel-race',NULL)",
        [
          cancelledAfterExternalOperation,
          cancelledAfterExternalJob.job_id,
          cancelledAfterExternalJob.attempt_id,
          "external-cancellation-worker",
          cancelledAfterExternalJob.lease_generation,
        ],
      ),
    { workspaceId },
  );
  const completionBeforeCancellation = await tx(
    "cumulore_worker",
    (client) =>
      client.query<{ complete_job_from_external_operation: boolean }>(
        "SELECT app.complete_job_from_external_operation($1,$2,$3,$4,$5)",
        [
          cancelledAfterExternalJob.job_id,
          cancelledAfterExternalJob.attempt_id,
          "external-cancellation-worker",
          cancelledAfterExternalJob.lease_generation,
          cancelledAfterExternalLogicalId,
        ],
      ),
    { workspaceId },
  );
  assert.equal(
    completionBeforeCancellation.rows[0]!.complete_job_from_external_operation,
    true,
    "fenced job success commits before the competing cancellation",
  );
  const cancellationAfterSuccess = await tx(
    "cumulore_web",
    (client) =>
      client.query<{ request_job_cancellation: boolean }>(
        "SELECT app.request_job_cancellation($1)",
        [cancelledAfterExternalJob.job_id],
      ),
    { userId, workspaceId },
  );
  assert.equal(
    cancellationAfterSuccess.rows[0]!.request_job_cancellation,
    false,
    "a later cancellation cannot reverse terminal success",
  );
  assert.deepEqual(
    (
      await pool.query(
        "SELECT state, cancel_requested_at IS NOT NULL AS cancellation_requested FROM jobs WHERE id = $1",
        [cancelledAfterExternalJob.job_id],
      )
    ).rows,
    [{ state: "succeeded", cancellation_requested: false }],
  );

  const cancelledBeforeExternalLogicalId = await createJob(
    userId,
    workspaceId,
    "external_success",
  );
  await tx("cumulore_worker", (client) =>
    client.query("SELECT app.dispatch_outbox(10)"),
  );
  const cancelledBeforeExternalClaim = await tx(
    "cumulore_worker",
    (client) =>
      client.query<DurableClaim>(
        "SELECT job_id, attempt_id, lease_generation FROM app.claim_jobs($1,1,60)",
        ["cancellation-first-worker"],
      ),
    { workspaceId },
  );
  const cancelledBeforeExternalJob = cancelledBeforeExternalClaim.rows[0]!;
  const cancelledBeforeExternalOperation = await prepareExternalOperation(
    workspaceId,
    "cancellation-first-worker",
    cancelledBeforeExternalLogicalId,
    cancelledBeforeExternalJob,
  );
  await tx(
    "cumulore_worker",
    (client) =>
      client.query("SELECT app.mark_external_in_flight($1,$2,$3,$4,$5)", [
        cancelledBeforeExternalOperation,
        cancelledBeforeExternalJob.job_id,
        cancelledBeforeExternalJob.attempt_id,
        "cancellation-first-worker",
        cancelledBeforeExternalJob.lease_generation,
      ]),
    { workspaceId },
  );
  const cancellationWon = await tx(
    "cumulore_web",
    (client) =>
      client.query<{ request_job_cancellation: boolean }>(
        "SELECT app.request_job_cancellation($1)",
        [cancelledBeforeExternalJob.job_id],
      ),
    { userId, workspaceId },
  );
  assert.equal(cancellationWon.rows[0]!.request_job_cancellation, true);
  await tx(
    "cumulore_worker",
    (client) =>
      client.query(
        "SELECT app.record_external_result($1,$2,$3,$4,$5,'succeeded','provider-after-cancel',NULL)",
        [
          cancelledBeforeExternalOperation,
          cancelledBeforeExternalJob.job_id,
          cancelledBeforeExternalJob.attempt_id,
          "cancellation-first-worker",
          cancelledBeforeExternalJob.lease_generation,
        ],
      ),
    { workspaceId },
  );
  const completionLostRace = await tx(
    "cumulore_worker",
    (client) =>
      client.query<{ complete_job_from_external_operation: boolean }>(
        "SELECT app.complete_job_from_external_operation($1,$2,$3,$4,$5)",
        [
          cancelledBeforeExternalJob.job_id,
          cancelledBeforeExternalJob.attempt_id,
          "cancellation-first-worker",
          cancelledBeforeExternalJob.lease_generation,
          cancelledBeforeExternalLogicalId,
        ],
      ),
    { workspaceId },
  );
  assert.equal(
    completionLostRace.rows[0]!.complete_job_from_external_operation,
    false,
    "external completion cannot overtake an earlier committed cancellation",
  );
  const cancellationAcknowledged = await tx(
    "cumulore_worker",
    (client) =>
      client.query<{ acknowledge_job_cancellation: boolean }>(
        "SELECT app.acknowledge_job_cancellation($1,$2,$3,$4)",
        [
          cancelledBeforeExternalJob.job_id,
          cancelledBeforeExternalJob.attempt_id,
          "cancellation-first-worker",
          cancelledBeforeExternalJob.lease_generation,
        ],
      ),
    { workspaceId },
  );
  assert.equal(
    cancellationAcknowledged.rows[0]!.acknowledge_job_cancellation,
    true,
  );
  assert.equal(
    (
      await pool.query("SELECT state FROM jobs WHERE id = $1", [
        cancelledBeforeExternalJob.job_id,
      ])
    ).rows[0].state,
    "cancelled",
  );

  const preparedCrash = await createAndClaimJob(
    userId,
    workspaceId,
    "prepared-crash-worker",
  );
  const preparedCrashOperation = await prepareExternalOperation(
    workspaceId,
    "prepared-crash-worker",
    preparedCrash.logicalOperationId,
    preparedCrash.claim,
  );
  await tx(
    "cumulore_worker",
    (client) =>
      client.query("SELECT app.fail_job($1,$2,$3,$4,true,'simulated_crash')", [
        preparedCrash.claim.job_id,
        preparedCrash.claim.attempt_id,
        "prepared-crash-worker",
        preparedCrash.claim.lease_generation,
      ]),
    { workspaceId },
  );
  const recoveredPrepared = await tx("cumulore_worker", (client) =>
    client.query<{ recovered: number }>(
      "SELECT app.recover_stale_external_operations(10) AS recovered",
    ),
  );
  assert.equal(recoveredPrepared.rows[0]!.recovered, 1);
  assert.deepEqual(
    (
      await pool.query(
        "SELECT state, safe_error_code FROM external_operations WHERE id = $1",
        [preparedCrashOperation],
      )
    ).rows,
    [{ state: "failed", safe_error_code: "invocation_not_started" }],
  );
  const preparedRetry = await tx(
    "cumulore_worker",
    (client) =>
      client.query<DurableClaim>(
        "SELECT job_id, attempt_id, lease_generation FROM app.claim_jobs($1,1,60)",
        ["prepared-retry-worker"],
      ),
    { workspaceId },
  );
  assert.equal(preparedRetry.rows[0]!.job_id, preparedCrash.claim.job_id);
  const preparedRequestHash = createHash("sha256")
    .update(preparedCrash.logicalOperationId)
    .digest();
  const linkedRetry = await tx(
    "cumulore_worker",
    (client) =>
      client.query<{ operation_id: string }>(
        "SELECT app.link_external_retry($1,$2,$3,$4,$5,$6) AS operation_id",
        [
          preparedCrashOperation,
          preparedRetry.rows[0]!.job_id,
          preparedRetry.rows[0]!.attempt_id,
          "prepared-retry-worker",
          preparedRetry.rows[0]!.lease_generation,
          preparedRequestHash,
        ],
      ),
    { workspaceId },
  );
  assert.ok(linkedRetry.rows[0]!.operation_id);
  const repeatedLink = await tx(
    "cumulore_worker",
    (client) =>
      client.query<{ operation_id: string }>(
        "SELECT app.link_external_retry($1,$2,$3,$4,$5,$6) AS operation_id",
        [
          preparedCrashOperation,
          preparedRetry.rows[0]!.job_id,
          preparedRetry.rows[0]!.attempt_id,
          "prepared-retry-worker",
          preparedRetry.rows[0]!.lease_generation,
          preparedRequestHash,
        ],
      ),
    { workspaceId },
  );
  assert.equal(
    repeatedLink.rows[0]!.operation_id,
    linkedRetry.rows[0]!.operation_id,
    "repeating the retry-link transaction returns the existing generation",
  );
  assert.deepEqual(
    (
      await pool.query(
        `SELECT count(*) AS operation_count,
                count(DISTINCT provider_idempotency_key) AS provider_key_count,
                count(DISTINCT request_hash) AS request_hash_count
         FROM external_operations WHERE job_id = $1`,
        [preparedCrash.claim.job_id],
      )
    ).rows,
    [
      {
        operation_count: "2",
        provider_key_count: "1",
        request_hash_count: "1",
      },
    ],
    "safe retries retain the stable provider key and canonical request",
  );
  await assert.rejects(
    () =>
      tx(
        "cumulore_worker",
        (client) =>
          client.query("SELECT app.link_external_retry($1,$2,$3,$4,$5,$6)", [
            preparedCrashOperation,
            preparedRetry.rows[0]!.job_id,
            preparedRetry.rows[0]!.attempt_id,
            "prepared-retry-worker",
            preparedRetry.rows[0]!.lease_generation,
            createHash("sha256").update("different-request").digest(),
          ]),
        { workspaceId },
      ),
    /does not match the original request/,
  );
  await tx(
    "cumulore_worker",
    (client) =>
      client.query("SELECT app.fail_job($1,$2,$3,$4,false,'test_complete')", [
        preparedRetry.rows[0]!.job_id,
        preparedRetry.rows[0]!.attempt_id,
        "prepared-retry-worker",
        preparedRetry.rows[0]!.lease_generation,
      ]),
    { workspaceId },
  );
  const recoveredLinkedRetry = await tx("cumulore_worker", (client) =>
    client.query<{ recovered: number }>(
      "SELECT app.recover_stale_external_operations(10) AS recovered",
    ),
  );
  assert.equal(recoveredLinkedRetry.rows[0]!.recovered, 1);

  const inFlightCrash = await createAndClaimJob(
    userId,
    workspaceId,
    "in-flight-crash-worker",
  );
  const inFlightCrashOperation = await prepareExternalOperation(
    workspaceId,
    "in-flight-crash-worker",
    inFlightCrash.logicalOperationId,
    inFlightCrash.claim,
  );
  await tx(
    "cumulore_worker",
    (client) =>
      client.query("SELECT app.mark_external_in_flight($1,$2,$3,$4,$5)", [
        inFlightCrashOperation,
        inFlightCrash.claim.job_id,
        inFlightCrash.claim.attempt_id,
        "in-flight-crash-worker",
        inFlightCrash.claim.lease_generation,
      ]),
    { workspaceId },
  );
  await tx(
    "cumulore_worker",
    (client) =>
      client.query("SELECT app.fail_job($1,$2,$3,$4,true,'simulated_crash')", [
        inFlightCrash.claim.job_id,
        inFlightCrash.claim.attempt_id,
        "in-flight-crash-worker",
        inFlightCrash.claim.lease_generation,
      ]),
    { workspaceId },
  );
  const recoveredInFlight = await tx("cumulore_worker", (client) =>
    client.query<{ recovered: number }>(
      "SELECT app.recover_stale_external_operations(10) AS recovered",
    ),
  );
  assert.equal(recoveredInFlight.rows[0]!.recovered, 1);
  assert.deepEqual(
    (
      await pool.query(
        "SELECT state, safe_error_code, next_reconcile_at IS NOT NULL AS scheduled " +
          "FROM external_operations WHERE id = $1",
        [inFlightCrashOperation],
      )
    ).rows,
    [
      {
        state: "unknown",
        safe_error_code: "invocation_outcome_unknown",
        scheduled: true,
      },
    ],
  );
  const unknownRetry = await tx(
    "cumulore_worker",
    (client) =>
      client.query<DurableClaim>(
        "SELECT job_id, attempt_id, lease_generation FROM app.claim_jobs($1,1,60)",
        ["unknown-retry-worker"],
      ),
    { workspaceId },
  );
  assert.equal(unknownRetry.rows[0]!.job_id, inFlightCrash.claim.job_id);
  const refusedUnknownRetry = await tx(
    "cumulore_worker",
    (client) =>
      client.query<{ operation_id: string | null }>(
        "SELECT app.link_external_retry($1,$2,$3,$4,$5,$6) AS operation_id",
        [
          inFlightCrashOperation,
          unknownRetry.rows[0]!.job_id,
          unknownRetry.rows[0]!.attempt_id,
          "unknown-retry-worker",
          unknownRetry.rows[0]!.lease_generation,
          createHash("sha256")
            .update(inFlightCrash.logicalOperationId)
            .digest(),
        ],
      ),
    { workspaceId },
  );
  assert.equal(
    refusedUnknownRetry.rows[0]!.operation_id,
    null,
    "an unknown provider outcome cannot be retried blindly",
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
