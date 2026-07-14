import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import type { PoolClient } from "pg";

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

type TestIdentity = {
  userA: string;
  userB: string;
  workspaceA: string;
  workspaceB: string;
};

type ClaimedJob = {
  job_id: string;
  workspace_id: string;
  event_id: string;
  event_type: string;
  schema_version: number;
  correlation_id: string;
  causation_id: string | null;
  handler_name: string;
  handler_version: number;
  attempt_id: string;
  lease_generation: string;
  lease_expires_at: Date;
  payload: { synthetic_operation_id: string };
};

async function withRole<T>(
  role: "cumulore_migration" | "cumulore_web" | "cumulore_worker",
  action: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SET LOCAL ROLE ${role}`);
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
  await withRole("cumulore_migration", async (client) => {
    await client.query(
      `TRUNCATE
         endpoint_idempotency_records,
         external_operations,
         job_effects,
         job_actions,
         job_attempts,
         jobs,
         outbox_events,
         synthetic_operations,
         event_handlers,
         folder_closure,
         folders,
         workspace_members,
         workspaces,
         external_identities,
         users
       CASCADE`,
    );
    await client.query(
      `INSERT INTO event_handlers (
         event_type,
         schema_version,
         handler_name,
         handler_version,
         requires_workspace
       ) VALUES ('durable.synthetic.requested', 1, 'run_synthetic', 1, true)`,
    );
  });
}

async function bootstrap(): Promise<TestIdentity> {
  const userA = await provisionIdentity(pool, {
    issuer: "https://fake.identity.local/",
    subject: `dispatch-a-${randomUUID()}`,
  });
  const userB = await provisionIdentity(pool, {
    issuer: "https://fake.identity.local/",
    subject: `dispatch-b-${randomUUID()}`,
  });
  return {
    userA,
    userB,
    workspaceA: await createWorkspace(pool, userA, "Dispatch A"),
    workspaceB: await createWorkspace(pool, userB, "Dispatch B"),
  };
}

async function createSynthetic(
  userId: string,
  workspaceId: string,
): Promise<{ operationId: string; eventId: string; correlationId: string }> {
  const correlationId = randomUUID();
  const created = await withActorTransaction(
    pool,
    { userId, workspaceId },
    (client) =>
      createSyntheticOperationAndEvent(client, {
        workspaceId,
        requestedByUserId: userId,
        scenario: "database_effect",
        inputVersion: 1,
        configurationVersion: 1,
        correlationId,
      }),
  );
  return { ...created, correlationId };
}

async function dispatch(batchSize = 50): Promise<number> {
  return withRole("cumulore_worker", async (client) => {
    const result = await client.query<{ dispatched: number }>(
      "SELECT app.dispatch_outbox($1) AS dispatched",
      [batchSize],
    );
    return result.rows[0]!.dispatched;
  });
}

async function claim(
  owner: string,
  batchSize = 1,
  leaseSeconds = 60,
): Promise<ClaimedJob[]> {
  return withRole("cumulore_worker", async (client) => {
    const result = await client.query<ClaimedJob>(
      "SELECT * FROM app.claim_jobs($1, $2, $3)",
      [owner, batchSize, leaseSeconds],
    );
    return result.rows;
  });
}

async function insertUnhandledEvent(workspaceId: string): Promise<string> {
  return withRole("cumulore_migration", async (client) => {
    const result = await client.query<{ id: string }>(
      `INSERT INTO outbox_events (
         scope,
         workspace_id,
         event_type,
         schema_version,
         actor_type,
         correlation_id,
         payload
       ) VALUES (
         'workspace', $1, 'durable.unhandled', 1, 'system', gen_random_uuid(), '{}'::jsonb
       ) RETURNING id`,
      [workspaceId],
    );
    return result.rows[0]!.id;
  });
}

try {
  const functionInspection = await pool.query<{
    function_name: string;
    owner: string;
    security_definer: boolean;
    config: string[];
    worker_execute: boolean;
    web_execute: boolean;
    public_execute: boolean;
  }>(
    `SELECT
       p.proname AS function_name,
       pg_get_userbyid(p.proowner) AS owner,
       p.prosecdef AS security_definer,
       p.proconfig AS config,
       has_function_privilege('cumulore_worker', p.oid, 'EXECUTE') AS worker_execute,
       has_function_privilege('cumulore_web', p.oid, 'EXECUTE') AS web_execute,
       EXISTS (
         SELECT 1
         FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) AS privilege
         WHERE privilege.grantee = 0 AND privilege.privilege_type = 'EXECUTE'
       ) AS public_execute
     FROM pg_proc AS p
     JOIN pg_namespace AS n ON n.oid = p.pronamespace
     WHERE n.nspname = 'app' AND p.proname IN ('claim_jobs', 'dispatch_outbox')
     ORDER BY p.proname`,
  );
  assert.equal(functionInspection.rowCount, 2);
  assert.ok(
    functionInspection.rows.every(
      (row) =>
        row.owner === "cumulore_migration" &&
        row.security_definer &&
        row.config.includes("search_path=pg_catalog, public, app") &&
        row.worker_execute &&
        !row.web_execute &&
        !row.public_execute,
    ),
    "dispatch and claim are fixed-path migration-owned worker functions without PUBLIC execution",
  );

  await reset();
  let identity = await bootstrap();

  const committed = await createSynthetic(identity.userA, identity.workspaceA);
  const committedRows = await pool.query<{
    operation_count: string;
    event_count: string;
  }>(
    `SELECT
       (SELECT count(*) FROM synthetic_operations WHERE id = $1) AS operation_count,
       (SELECT count(*) FROM outbox_events WHERE id = $2) AS event_count`,
    [committed.operationId, committed.eventId],
  );
  assert.deepEqual(committedRows.rows[0], {
    operation_count: "1",
    event_count: "1",
  });

  await assert.rejects(() =>
    withActorTransaction(
      pool,
      { userId: identity.userA, workspaceId: identity.workspaceA },
      async (client) => {
        await createSyntheticOperationAndEvent(client, {
          workspaceId: identity.workspaceA,
          requestedByUserId: identity.userA,
          scenario: "database_effect",
          inputVersion: 1,
          configurationVersion: 1,
          correlationId: randomUUID(),
        });
        throw new Error("force command rollback");
      },
    ),
  );
  const afterRollback = await pool.query<{ count: string }>(
    "SELECT count(*) FROM synthetic_operations",
  );
  assert.equal(afterRollback.rows[0]!.count, "1");

  await assert.rejects(() =>
    withActorTransaction(
      pool,
      { userId: identity.userA, workspaceId: identity.workspaceA },
      (client) =>
        createSyntheticOperationAndEvent(client, {
          workspaceId: identity.workspaceA,
          requestedByUserId: identity.userA,
          scenario: "database_effect",
          inputVersion: 1,
          configurationVersion: 1,
          correlationId: "invalid-correlation-id",
        }),
    ),
  );
  const afterInvalidContract = await pool.query<{ count: string }>(
    "SELECT count(*) FROM synthetic_operations",
  );
  assert.equal(afterInvalidContract.rows[0]!.count, "1");

  await assert.rejects(() =>
    withActorTransaction(
      pool,
      { userId: identity.userA, workspaceId: identity.workspaceA },
      (client) =>
        createSyntheticOperationAndEvent(client, {
          workspaceId: identity.workspaceB,
          requestedByUserId: identity.userA,
          scenario: "database_effect",
          inputVersion: 1,
          configurationVersion: 1,
          correlationId: randomUUID(),
        }),
    ),
  );

  await assert.rejects(() =>
    withRole("cumulore_web", (client) =>
      client.query("SELECT app.dispatch_outbox(1)"),
    ),
  );
  await assert.rejects(() => dispatch(0));
  await assert.rejects(() => dispatch(101));
  await assert.rejects(() => claim(" "));
  await assert.rejects(() => claim("worker", 11));
  await assert.rejects(() => claim("worker", 1, 301));

  const unhandledEventId = await insertUnhandledEvent(identity.workspaceA);
  const globalSyntheticEventId = await withRole(
    "cumulore_migration",
    async (client) => {
      const result = await client.query<{ id: string }>(
        `INSERT INTO outbox_events (
           scope,
           event_type,
           schema_version,
           actor_type,
           correlation_id,
           payload
         ) VALUES (
           'global',
           'durable.synthetic.requested',
           1,
           'system',
           gen_random_uuid(),
           jsonb_build_object('synthetic_operation_id', gen_random_uuid())
         ) RETURNING id`,
      );
      return result.rows[0]!.id;
    },
  );
  assert.equal(await dispatch(), 3);
  const dispatchResults = await pool.query<{
    id: string;
    handler_count: number;
    job_count: string;
  }>(
    `SELECT
       event.id,
       event.dispatched_handler_count AS handler_count,
       count(job.id) AS job_count
     FROM outbox_events AS event
     LEFT JOIN jobs AS job ON job.event_id = event.id
     WHERE event.id IN ($1, $2, $3)
     GROUP BY event.id
     ORDER BY event.id`,
    [committed.eventId, unhandledEventId, globalSyntheticEventId],
  );
  const syntheticDispatch = dispatchResults.rows.find(
    (row) => row.id === committed.eventId,
  );
  const unhandledDispatch = dispatchResults.rows.find(
    (row) => row.id === unhandledEventId,
  );
  const globalSyntheticDispatch = dispatchResults.rows.find(
    (row) => row.id === globalSyntheticEventId,
  );
  assert.deepEqual(
    {
      handlerCount: syntheticDispatch?.handler_count,
      jobCount: syntheticDispatch?.job_count,
    },
    { handlerCount: 1, jobCount: "1" },
  );
  assert.deepEqual(
    {
      handlerCount: unhandledDispatch?.handler_count,
      jobCount: unhandledDispatch?.job_count,
    },
    { handlerCount: 0, jobCount: "0" },
  );
  assert.deepEqual(
    {
      handlerCount: globalSyntheticDispatch?.handler_count,
      jobCount: globalSyntheticDispatch?.job_count,
    },
    { handlerCount: 0, jobCount: "0" },
    "workspace-required handlers reject null-workspace events",
  );

  await withRole("cumulore_migration", (client) =>
    client.query(
      `INSERT INTO event_handlers (
         event_type, schema_version, handler_name, handler_version, requires_workspace
       ) VALUES ('durable.synthetic.requested', 1, 'audit_synthetic', 1, true)`,
    ),
  );
  const multiHandler = await createSynthetic(
    identity.userA,
    identity.workspaceA,
  );
  assert.equal(await dispatch(), 1);
  const multiJobs = await pool.query<{
    handler_name: string;
    handler_version: number;
  }>(
    `SELECT handler_name, handler_version FROM jobs
     WHERE event_id = $1 ORDER BY handler_name`,
    [multiHandler.eventId],
  );
  assert.deepEqual(multiJobs.rows, [
    { handler_name: "audit_synthetic", handler_version: 1 },
    { handler_name: "run_synthetic", handler_version: 1 },
  ]);
  const historicalJobs = await pool.query<{ count: string }>(
    "SELECT count(*) FROM jobs WHERE event_id = $1",
    [committed.eventId],
  );
  assert.equal(
    historicalJobs.rows[0]!.count,
    "1",
    "handler activation does not backfill",
  );

  await withRole("cumulore_migration", async (client) => {
    await client.query(
      `UPDATE event_handlers
       SET active = false, deactivated_at = clock_timestamp()
       WHERE event_type = 'durable.synthetic.requested'
         AND schema_version = 1
         AND handler_name = 'run_synthetic'
         AND handler_version = 1`,
    );
    await client.query(
      `INSERT INTO event_handlers (
         event_type, schema_version, handler_name, handler_version, requires_workspace
       ) VALUES ('durable.synthetic.requested', 1, 'run_synthetic', 2, true)`,
    );
  });
  const versioned = await createSynthetic(identity.userA, identity.workspaceA);
  assert.equal(await dispatch(), 1);
  const versionedJobs = await pool.query<{
    handler_name: string;
    handler_version: number;
  }>(
    `SELECT handler_name, handler_version FROM jobs
     WHERE event_id = $1 ORDER BY handler_name`,
    [versioned.eventId],
  );
  assert.deepEqual(versionedJobs.rows, [
    { handler_name: "audit_synthetic", handler_version: 1 },
    { handler_name: "run_synthetic", handler_version: 2 },
  ]);
  const pinned = await pool.query<{ handler_version: number }>(
    `SELECT handler_version FROM jobs
     WHERE event_id = $1 AND handler_name = 'run_synthetic'`,
    [committed.eventId],
  );
  assert.equal(pinned.rows[0]!.handler_version, 1);

  await withRole("cumulore_migration", (client) =>
    client.query(
      "UPDATE outbox_events SET dispatch_completed_at = NULL, dispatched_handler_count = 0 WHERE id = $1",
      [versioned.eventId],
    ),
  );
  assert.equal(await dispatch(), 1);
  const redispatchCount = await pool.query<{ count: string }>(
    "SELECT count(*) FROM jobs WHERE event_id = $1",
    [versioned.eventId],
  );
  assert.equal(
    redispatchCount.rows[0]!.count,
    "2",
    "redispatch is duplicate-safe",
  );

  await reset();
  identity = await bootstrap();
  const lockedFirst = await createSynthetic(
    identity.userA,
    identity.workspaceA,
  );
  const unlockedSecond = await createSynthetic(
    identity.userA,
    identity.workspaceA,
  );
  await withRole("cumulore_migration", async (client) => {
    await client.query(
      `UPDATE outbox_events
       SET occurred_at = CASE id WHEN $1 THEN '2026-01-01T00:00:00Z'::timestamptz
                                 ELSE '2026-01-01T00:00:01Z'::timestamptz END
       WHERE id IN ($1, $2)`,
      [lockedFirst.eventId, unlockedSecond.eventId],
    );
  });
  const dispatchLock = await pool.connect();
  try {
    await dispatchLock.query("BEGIN");
    await dispatchLock.query("SET LOCAL ROLE cumulore_migration");
    await dispatchLock.query(
      "SELECT id FROM outbox_events WHERE id = $1 FOR UPDATE",
      [lockedFirst.eventId],
    );
    assert.equal(await dispatch(1), 1);
    const skipped = await pool.query<{
      id: string;
      dispatched: boolean;
    }>(
      `SELECT id, dispatch_completed_at IS NOT NULL AS dispatched
       FROM outbox_events WHERE id IN ($1, $2) ORDER BY id`,
      [lockedFirst.eventId, unlockedSecond.eventId],
    );
    assert.equal(
      skipped.rows.find((row) => row.id === lockedFirst.eventId)?.dispatched,
      false,
    );
    assert.equal(
      skipped.rows.find((row) => row.id === unlockedSecond.eventId)?.dispatched,
      true,
    );
    await dispatchLock.query("ROLLBACK");
  } finally {
    dispatchLock.release();
  }

  const rollbackEvent = lockedFirst;
  const rollbackDispatcher = await pool.connect();
  try {
    await rollbackDispatcher.query("BEGIN");
    await rollbackDispatcher.query("SET LOCAL ROLE cumulore_worker");
    const selected = await rollbackDispatcher.query<{ count: number }>(
      "SELECT app.dispatch_outbox(1) AS count",
    );
    assert.equal(selected.rows[0]!.count, 1);
    await rollbackDispatcher.query("ROLLBACK");
  } finally {
    rollbackDispatcher.release();
  }
  const rolledBackDispatch = await pool.query<{
    dispatched: boolean;
    jobs: string;
  }>(
    `SELECT
       dispatch_completed_at IS NOT NULL AS dispatched,
       (SELECT count(*) FROM jobs WHERE event_id = outbox_events.id) AS jobs
     FROM outbox_events WHERE id = $1`,
    [rollbackEvent.eventId],
  );
  assert.deepEqual(rolledBackDispatch.rows[0], {
    dispatched: false,
    jobs: "0",
  });
  assert.equal(await dispatch(1), 1);

  const concurrentDispatchEvents = await Promise.all(
    Array.from({ length: 6 }, () =>
      createSynthetic(identity.userA, identity.workspaceA),
    ),
  );
  const concurrentDispatchCounts = await Promise.all(
    Array.from({ length: 6 }, () => dispatch(1)),
  );
  assert.equal(
    concurrentDispatchCounts.reduce((total, count) => total + count, 0),
    6,
  );
  const concurrentlyDispatchedJobs = await pool.query<{ count: string }>(
    "SELECT count(*) FROM jobs WHERE event_id = ANY($1::uuid[])",
    [concurrentDispatchEvents.map((event) => event.eventId)],
  );
  assert.equal(concurrentlyDispatchedJobs.rows[0]!.count, "6");

  await reset();
  identity = await bootstrap();
  const claimInputs = await Promise.all([
    createSynthetic(identity.userA, identity.workspaceA),
    createSynthetic(identity.userA, identity.workspaceA),
    createSynthetic(identity.userA, identity.workspaceA),
    createSynthetic(identity.userB, identity.workspaceB),
    createSynthetic(identity.userB, identity.workspaceB),
    createSynthetic(identity.userB, identity.workspaceB),
  ]);
  assert.equal(await dispatch(), 6);
  await withRole("cumulore_migration", (client) =>
    client.query(
      `UPDATE jobs
       SET available_at = '2026-01-01T00:00:00Z'::timestamptz
         + (ordered.ordinality - 1) * interval '1 second'
       FROM unnest($1::uuid[]) WITH ORDINALITY AS ordered(event_id, ordinality)
       WHERE jobs.event_id = ordered.event_id`,
      [claimInputs.map((input) => input.eventId)],
    ),
  );

  let skippedClaim: ClaimedJob[] = [];
  const claimLock = await pool.connect();
  try {
    await claimLock.query("BEGIN");
    await claimLock.query("SET LOCAL ROLE cumulore_migration");
    await claimLock.query(
      "SELECT id FROM jobs WHERE event_id = $1 FOR UPDATE",
      [claimInputs[0]!.eventId],
    );
    skippedClaim = await claim("skip-locked-worker", 1);
    assert.equal(skippedClaim.length, 1);
    assert.equal(skippedClaim[0]!.event_id, claimInputs[1]!.eventId);
    await claimLock.query("ROLLBACK");
  } finally {
    claimLock.release();
  }

  const rollbackClaimer = await pool.connect();
  try {
    await rollbackClaimer.query("BEGIN");
    await rollbackClaimer.query("SET LOCAL ROLE cumulore_worker");
    const provisional = await rollbackClaimer.query<ClaimedJob>(
      "SELECT * FROM app.claim_jobs('rollback-worker', 1, 60)",
    );
    assert.equal(provisional.rows[0]!.event_id, claimInputs[0]!.eventId);
    await rollbackClaimer.query("ROLLBACK");
  } finally {
    rollbackClaimer.release();
  }
  const afterClaimRollback = await pool.query<{
    state: string;
    attempts: string;
  }>(
    `SELECT
       state,
       (SELECT count(*) FROM job_attempts WHERE job_id = jobs.id) AS attempts
     FROM jobs WHERE event_id = $1`,
    [claimInputs[0]!.eventId],
  );
  assert.deepEqual(afterClaimRollback.rows[0], {
    state: "pending",
    attempts: "0",
  });

  const orderedBatch = await claim("ordered-batch-worker", 2);
  assert.deepEqual(
    orderedBatch.map((row) => row.event_id),
    [claimInputs[0]!.eventId, claimInputs[2]!.eventId],
    "batch claims preserve deterministic availability order",
  );

  const concurrentClaims = await Promise.all([
    claim("concurrent-worker-a", 1),
    claim("concurrent-worker-b", 1),
    claim("concurrent-worker-c", 1),
  ]);
  const claimed = concurrentClaims.flat();
  assert.equal(claimed.length, 3);
  assert.equal(new Set(claimed.map((row) => row.job_id)).size, 3);
  const allClaims = [skippedClaim[0]!, ...orderedBatch, ...claimed];
  assert.deepEqual(
    new Set(allClaims.map((row) => row.workspace_id)),
    new Set([identity.workspaceA, identity.workspaceB]),
  );
  for (const row of allClaims) {
    const source = claimInputs.find((input) => input.eventId === row.event_id);
    assert.equal(row.payload.synthetic_operation_id, source?.operationId);
    assert.equal(row.schema_version, 1);
    assert.equal(row.handler_name, "run_synthetic");
    assert.equal(row.handler_version, 1);
  }

  const claimAtomicity = await pool.query<{
    job_id: string;
    active_attempt_id: string;
    attempt_id: string;
    state: string;
    worker_owner: string;
    lease_generation: string;
  }>(
    `SELECT
       job.id AS job_id,
       job.active_attempt_id,
       attempt.id AS attempt_id,
       job.state,
       job.worker_owner,
       job.lease_generation
     FROM jobs AS job
     JOIN job_attempts AS attempt
       ON attempt.workspace_id = job.workspace_id
       AND attempt.job_id = job.id
       AND attempt.id = job.active_attempt_id
     ORDER BY job.id`,
  );
  assert.equal(claimAtomicity.rowCount, 6);
  assert.ok(
    claimAtomicity.rows.every(
      (row) =>
        row.state === "running" &&
        row.active_attempt_id === row.attempt_id &&
        row.lease_generation === "1" &&
        row.worker_owner.length > 0,
    ),
    "every claim atomically links one attempt and one running lease",
  );

  await assert.rejects(() =>
    withRole("cumulore_worker", (client) =>
      client.query("UPDATE jobs SET available_at = clock_timestamp()"),
    ),
  );
  await assert.rejects(() =>
    withRole("cumulore_web", (client) =>
      client.query("SELECT * FROM app.claim_jobs('web-worker', 1, 60)"),
    ),
  );

  console.log(
    "PostgreSQL durable dispatch and claim integration tests passed.",
  );
} finally {
  await pool.end();
}
