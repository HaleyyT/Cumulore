import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import type { Pool, PoolClient } from "pg";

import {
  createPool,
  createSyntheticOperationAndEvent,
  createWorkspace,
  provisionIdentity,
  withActorTransaction,
} from "../src/index.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString)
  throw new Error("DATABASE_URL is required for integration tests");
const pool = createPool(connectionString);

type Identity = {
  userA: string;
  userB: string;
  workspaceA: string;
  workspaceB: string;
};

type ClaimedJob = {
  job_id: string;
  workspace_id: string;
  event_id: string;
  attempt_id: string;
  lease_generation: string;
};

async function transaction<T>(
  poolToUse: Pool,
  role: "cumulore_migration" | "cumulore_web" | "cumulore_worker",
  action: (client: PoolClient) => Promise<T>,
  context?: { userId?: string; workspaceId?: string },
): Promise<T> {
  const client = await poolToUse.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SET LOCAL ROLE ${role}`);
    if (context?.userId !== undefined)
      await client.query("SELECT set_config('app.user_id', $1, true)", [
        context.userId,
      ]);
    if (context?.workspaceId !== undefined)
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

async function reset(): Promise<void> {
  await transaction(pool, "cumulore_migration", (client) =>
    client.query(
      `TRUNCATE endpoint_idempotency_records, external_operations, job_effects,
       job_actions, job_attempts, jobs, outbox_events, synthetic_operations,
       event_handlers, folder_closure, folders, workspace_members, workspaces,
       external_identities, users CASCADE`,
    ),
  );
  await transaction(pool, "cumulore_migration", (client) =>
    client.query(
      `INSERT INTO event_handlers (
         event_type, schema_version, handler_name, handler_version, requires_workspace
       ) VALUES ('durable.synthetic.requested', 1, 'run_synthetic', 1, true)`,
    ),
  );
}

async function bootstrap(): Promise<Identity> {
  const userA = await provisionIdentity(pool, {
    issuer: "https://fake.identity.local/",
    subject: `transition-a-${randomUUID()}`,
  });
  const userB = await provisionIdentity(pool, {
    issuer: "https://fake.identity.local/",
    subject: `transition-b-${randomUUID()}`,
  });
  return {
    userA,
    userB,
    workspaceA: await createWorkspace(pool, userA, "Transition A"),
    workspaceB: await createWorkspace(pool, userB, "Transition B"),
  };
}

async function createJob(identity: Identity): Promise<string> {
  const created = await withActorTransaction(
    pool,
    { userId: identity.userA, workspaceId: identity.workspaceA },
    (client) =>
      createSyntheticOperationAndEvent(client, {
        workspaceId: identity.workspaceA,
        requestedByUserId: identity.userA,
        scenario: "database_effect",
        inputVersion: 1,
        configurationVersion: 1,
        correlationId: randomUUID(),
      }),
  );
  await transaction(pool, "cumulore_worker", (client) =>
    client.query("SELECT app.dispatch_outbox(100)"),
  );
  return created.operationId;
}

async function jobForOperation(operationId: string): Promise<string> {
  const result = await pool.query<{ id: string }>(
    `SELECT jobs.id
     FROM jobs
     JOIN outbox_events ON outbox_events.id = jobs.event_id
     WHERE outbox_events.payload->>'synthetic_operation_id' = $1`,
    [operationId],
  );
  return result.rows[0]!.id;
}

async function claim(identity: Identity, owner: string): Promise<ClaimedJob[]> {
  return transaction(
    pool,
    "cumulore_worker",
    async (client) => {
      const result = await client.query<ClaimedJob>(
        "SELECT * FROM app.claim_jobs($1, 1, 60)",
        [owner],
      );
      return result.rows;
    },
    { workspaceId: identity.workspaceA },
  );
}

async function inspectJob(jobId: string): Promise<{
  state: string;
  retry_generation: number;
  generation_attempt_count: number;
  lifetime_attempt_count: number;
  lease_generation: string;
  cancel_requested_at: Date | null;
}> {
  const result = await pool.query(
    `SELECT state, retry_generation, generation_attempt_count,
            lifetime_attempt_count, lease_generation, cancel_requested_at
     FROM jobs WHERE id = $1`,
    [jobId],
  );
  return result.rows[0]!;
}

try {
  const functions = await pool.query<{
    proname: string;
    owner: string;
    security_definer: boolean;
    config: string[];
    public_execute: boolean;
    worker_execute: boolean;
    web_execute: boolean;
  }>(
    `SELECT p.proname, pg_get_userbyid(p.proowner) AS owner,
            p.prosecdef AS security_definer, p.proconfig AS config,
            has_function_privilege('cumulore_worker', p.oid, 'EXECUTE') AS worker_execute,
            has_function_privilege('cumulore_web', p.oid, 'EXECUTE') AS web_execute,
            EXISTS (
              SELECT 1 FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
              WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE'
            ) AS public_execute
     FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'app' AND p.proname = ANY($1::text[])
     ORDER BY p.proname`,
    [
      [
        "renew_job_lease",
        "complete_job",
        "fail_job",
        "reclaim_expired_jobs",
        "request_job_cancellation",
        "acknowledge_job_cancellation",
        "manual_retry_job",
      ],
    ],
  );
  assert.equal(functions.rowCount, 7);
  assert.ok(
    functions.rows.every(
      (row) =>
        row.owner === "cumulore_migration" &&
        row.security_definer &&
        row.config.includes("search_path=pg_catalog, public, app") &&
        !row.public_execute,
    ),
    "transition functions are migration-owned fixed-path SECURITY DEFINER functions",
  );
  assert.ok(
    functions.rows
      .filter((row) =>
        ["request_job_cancellation", "manual_retry_job"].includes(row.proname),
      )
      .every((row) => row.web_execute && !row.worker_execute),
    "web transition functions are web-only",
  );
  assert.ok(
    functions.rows
      .filter(
        (row) =>
          !["request_job_cancellation", "manual_retry_job"].includes(
            row.proname,
          ),
      )
      .every((row) => row.worker_execute && !row.web_execute),
    "worker transition functions are worker-only",
  );

  await reset();
  const identity = await bootstrap();

  const pendingOperation = await createJob(identity);
  const pendingJob = await jobForOperation(pendingOperation);
  await transaction(
    pool,
    "cumulore_web",
    (client) =>
      client.query("SELECT app.request_job_cancellation($1)", [pendingJob]),
    { userId: identity.userA, workspaceId: identity.workspaceA },
  );
  assert.equal((await inspectJob(pendingJob)).state, "cancelled");
  assert.equal(
    (
      await pool.query("SELECT count(*) FROM job_actions WHERE job_id = $1", [
        pendingJob,
      ])
    ).rows[0].count,
    "1",
  );

  const runningOperation = await createJob(identity);
  const runningJob = await jobForOperation(runningOperation);
  const runningClaim = await claim(identity, "transition-worker-a");
  assert.equal(runningClaim.length, 1);
  const running = runningClaim[0]!;
  assert.equal(running.job_id, runningJob);

  await assert.rejects(() =>
    transaction(
      pool,
      "cumulore_worker",
      (client) =>
        client.query("SELECT app.renew_job_lease($1, $2, $3, $4, 301)", [
          running.job_id,
          running.attempt_id,
          "transition-worker-a",
          running.lease_generation,
        ]),
      { workspaceId: identity.workspaceA },
    ),
  );
  await transaction(
    pool,
    "cumulore_worker",
    (client) =>
      client.query("SELECT app.renew_job_lease($1, $2, $3, $4, 120)", [
        running.job_id,
        running.attempt_id,
        "transition-worker-a",
        running.lease_generation,
      ]),
    { workspaceId: identity.workspaceA },
  );

  await transaction(
    pool,
    "cumulore_web",
    (client) =>
      client.query("SELECT app.request_job_cancellation($1)", [runningJob]),
    { userId: identity.userA, workspaceId: identity.workspaceA },
  );
  const staleCompletion = await transaction(
    pool,
    "cumulore_worker",
    (client) =>
      client.query<{ complete_job: boolean }>(
        "SELECT app.complete_job($1, $2, $3, $4)",
        [
          running.job_id,
          running.attempt_id,
          "transition-worker-a",
          running.lease_generation,
        ],
      ),
    { workspaceId: identity.workspaceA },
  );
  assert.equal(staleCompletion.rows[0]!.complete_job, false);
  await transaction(
    pool,
    "cumulore_worker",
    (client) =>
      client.query("SELECT app.acknowledge_job_cancellation($1, $2, $3, $4)", [
        running.job_id,
        running.attempt_id,
        "transition-worker-a",
        running.lease_generation,
      ]),
    { workspaceId: identity.workspaceA },
  );
  assert.equal((await inspectJob(runningJob)).state, "cancelled");

  const reclaimOperation = await createJob(identity);
  const reclaimJob = await jobForOperation(reclaimOperation);
  const reclaimClaim = await claim(identity, "transition-worker-reclaim");
  assert.equal(reclaimClaim[0]!.job_id, reclaimJob);
  await transaction(pool, "cumulore_migration", (client) =>
    client.query(
      "UPDATE jobs SET lease_expires_at = clock_timestamp() - interval '1 second' WHERE id = $1",
      [reclaimJob],
    ),
  );
  const reclaimed = await transaction(
    pool,
    "cumulore_worker",
    (client) =>
      client.query<{ reclaim_expired_jobs: number }>(
        "SELECT app.reclaim_expired_jobs()",
      ),
    { workspaceId: identity.workspaceA },
  );
  assert.equal(reclaimed.rows[0]!.reclaim_expired_jobs, 1);
  const reclaimedState = await inspectJob(reclaimJob);
  assert.equal(reclaimedState.state, "retry_wait");
  await transaction(pool, "cumulore_migration", (client) =>
    client.query(
      "UPDATE jobs SET available_at = clock_timestamp() + interval '1 hour' WHERE id = $1",
      [reclaimJob],
    ),
  );
  assert.deepEqual(
    (
      await pool.query(
        "SELECT outcome, safe_error_code FROM job_attempts WHERE job_id = $1",
        [reclaimJob],
      )
    ).rows[0],
    { outcome: "abandoned", safe_error_code: "lease_expired" },
  );
  const staleRenew = await transaction(
    pool,
    "cumulore_worker",
    (client) =>
      client.query<{ renew_job_lease: boolean }>(
        "SELECT app.renew_job_lease($1, $2, $3, $4)",
        [
          reclaimJob,
          reclaimClaim[0]!.attempt_id,
          "transition-worker-reclaim",
          reclaimClaim[0]!.lease_generation,
        ],
      ),
    { workspaceId: identity.workspaceA },
  );
  assert.equal(staleRenew.rows[0]!.renew_job_lease, false);

  const retryOperation = await createJob(identity);
  const retryJob = await jobForOperation(retryOperation);
  const retryClaim = await claim(identity, "transition-worker-retry");
  assert.equal(retryClaim[0]!.job_id, retryJob);
  await transaction(
    pool,
    "cumulore_worker",
    (client) =>
      client.query(
        "SELECT app.fail_job($1, $2, $3, $4, false, 'synthetic_failure')",
        [
          retryJob,
          retryClaim[0]!.attempt_id,
          "transition-worker-retry",
          retryClaim[0]!.lease_generation,
        ],
      ),
    { workspaceId: identity.workspaceA },
  );
  assert.equal((await inspectJob(retryJob)).state, "dead_letter");
  await transaction(
    pool,
    "cumulore_web",
    (client) =>
      client.query("SELECT app.manual_retry_job($1, 'operator review')", [
        retryJob,
      ]),
    { userId: identity.userA, workspaceId: identity.workspaceA },
  );
  const retriedState = await inspectJob(retryJob);
  assert.equal(retriedState.state, "pending");
  assert.equal(retriedState.retry_generation, 1);
  assert.equal(retriedState.generation_attempt_count, 0);
  assert.deepEqual(
    (
      await pool.query(
        "SELECT action, reason FROM job_actions WHERE job_id = $1 AND action = 'manual_retry'",
        [retryJob],
      )
    ).rows[0],
    { action: "manual_retry", reason: "operator review" },
  );
  const unauthorizedRetry = await transaction(
    pool,
    "cumulore_web",
    (client) =>
      client.query<{ manual_retry_job: boolean }>(
        "SELECT app.manual_retry_job($1, 'wrong workspace')",
        [retryJob],
      ),
    { userId: identity.userB, workspaceId: identity.workspaceB },
  );
  assert.equal(unauthorizedRetry.rows[0]!.manual_retry_job, false);

  await reset();
  await pool.end();
  console.log("Durable transition integration tests passed.");
} catch (error) {
  await pool.end();
  throw error;
}
