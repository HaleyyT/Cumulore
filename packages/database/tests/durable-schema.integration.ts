import assert from "node:assert/strict";

import type { PoolClient } from "pg";

import {
  createPool,
  createWorkspace,
  provisionIdentity,
  withActorTransaction,
} from "../src/index.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString)
  throw new Error("DATABASE_URL is required for integration tests");
const pool = createPool(connectionString);

const durableTables = [
  "endpoint_idempotency_records",
  "event_handlers",
  "external_operations",
  "job_actions",
  "job_attempts",
  "job_effects",
  "jobs",
  "outbox_events",
  "synthetic_operations",
] as const;

const forcedRlsTables = durableTables.filter(
  (table) => table !== "event_handlers",
);

async function withRole<T>(
  client: PoolClient,
  role: "cumulore_migration" | "cumulore_worker",
  action: () => Promise<T>,
): Promise<T> {
  await client.query("BEGIN");
  try {
    await client.query(`SET LOCAL ROLE ${role}`);
    const result = await action();
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

async function setWorkerWorkspace(
  client: PoolClient,
  workspaceId: string,
): Promise<void> {
  await client.query("SELECT set_config('app.workspace_id', $1, true)", [
    workspaceId,
  ]);
}

try {
  const inspection = await pool.connect();
  try {
    const owners = await inspection.query<{
      table_name: string;
      owner: string;
    }>(
      `SELECT c.relname AS table_name, pg_get_userbyid(c.relowner) AS owner
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname = ANY($1::text[])
       ORDER BY c.relname`,
      [durableTables],
    );
    assert.deepEqual(
      owners.rows.map((row) => row.table_name),
      [...durableTables].sort(),
      "all durable tables exist",
    );
    assert.ok(
      owners.rows.every((row) => row.owner === "cumulore_migration"),
      "all durable tables are migration-owned",
    );

    const ownedTypes = await inspection.query<{
      type_name: string;
      owner: string;
    }>(
      `SELECT t.typname AS type_name, pg_get_userbyid(t.typowner) AS owner
       FROM pg_type t
       WHERE t.typnamespace = 'public'::regnamespace AND t.typname = ANY($1::text[])
       ORDER BY t.typname`,
      [
        [
          "durable_job_state",
          "endpoint_idempotency_status",
          "event_actor_type",
          "event_scope",
          "external_operation_state",
          "job_action_type",
          "job_attempt_outcome",
          "job_retry_classification",
          "synthetic_operation_scenario",
        ],
      ],
    );
    assert.equal(ownedTypes.rowCount, 9, "all durable enums exist");
    assert.ok(
      ownedTypes.rows.every((row) => row.owner === "cumulore_migration"),
      "all durable enums are migration-owned",
    );

    const guardOwner = await inspection.query<{ owner: string }>(
      `SELECT pg_get_userbyid(p.proowner) AS owner
       FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'app' AND p.proname = 'guard_job_attempt_history'`,
    );
    assert.deepEqual(guardOwner.rows, [{ owner: "cumulore_migration" }]);

    const rls = await inspection.query<{
      table_name: string;
      enabled: boolean;
      forced: boolean;
    }>(
      `SELECT relname AS table_name, relrowsecurity AS enabled, relforcerowsecurity AS forced
       FROM pg_class
       WHERE relnamespace = 'public'::regnamespace AND relname = ANY($1::text[])
       ORDER BY relname`,
      [forcedRlsTables],
    );
    assert.equal(rls.rowCount, forcedRlsTables.length);
    assert.ok(
      rls.rows.every((row) => row.enabled && row.forced),
      "every scoped durable table has forced RLS",
    );

    const roleSafety = await inspection.query<{
      role_name: string;
      bypass_rls: boolean;
      superuser: boolean;
    }>(
      `SELECT rolname AS role_name, rolbypassrls AS bypass_rls, rolsuper AS superuser
       FROM pg_roles
       WHERE rolname IN ('cumulore_web', 'cumulore_worker')
       ORDER BY rolname`,
    );
    assert.ok(
      roleSafety.rows.every((role) => !role.bypass_rls && !role.superuser),
      "runtime roles cannot bypass RLS",
    );
    const workerCreate = await inspection.query<{ can_create: boolean }>(
      "SELECT has_schema_privilege('cumulore_worker', 'public', 'CREATE') OR has_schema_privilege('cumulore_worker', 'app', 'CREATE') AS can_create",
    );
    assert.equal(workerCreate.rows[0]!.can_create, false);

    for (const table of [
      "event_handlers",
      "jobs",
      "job_attempts",
      "job_actions",
      "job_effects",
      "external_operations",
    ]) {
      const mutations = await inspection.query<{ can_mutate: boolean }>(
        `SELECT has_table_privilege('cumulore_worker', $1, 'INSERT,UPDATE,DELETE,TRUNCATE')
             OR has_table_privilege('cumulore_web', $1, 'INSERT,UPDATE,DELETE,TRUNCATE') AS can_mutate`,
        [table],
      );
      assert.equal(
        mutations.rows[0]!.can_mutate,
        false,
        `${table} has no runtime mutation grant`,
      );
    }

    const handler = await inspection.query<{
      handler_name: string;
      handler_version: number;
      requires_workspace: boolean;
      active: boolean;
    }>(
      `SELECT handler_name, handler_version, requires_workspace, active
       FROM event_handlers
       WHERE event_type = 'durable.synthetic.requested' AND schema_version = 1`,
    );
    assert.deepEqual(handler.rows, [
      {
        handler_name: "run_synthetic",
        handler_version: 1,
        requires_workspace: true,
        active: true,
      },
    ]);

    const requiredIndexes = await inspection.query<{ indexname: string }>(
      `SELECT indexname FROM pg_indexes
       WHERE schemaname = 'public' AND indexname = ANY($1::text[])`,
      [
        [
          "outbox_events_undispatched_idx",
          "event_handlers_one_active_version_idx",
          "jobs_claim_idx",
          "jobs_expired_lease_idx",
          "jobs_nonterminal_handler_idx",
          "external_operations_due_reconciliation_idx",
        ],
      ],
    );
    assert.equal(
      requiredIndexes.rowCount,
      6,
      "durable selection indexes exist",
    );

    const requiredConstraints = await inspection.query<{ conname: string }>(
      `SELECT conname FROM pg_constraint
       WHERE conname = ANY($1::text[])`,
      [
        [
          "outbox_scope_workspace_check",
          "outbox_actor_check",
          "endpoint_idempotency_response_check",
          "jobs_running_lease_check",
          "jobs_active_attempt_fk",
          "job_attempts_closure_check",
          "job_effects_result_check",
          "external_operations_state_check",
        ],
      ],
    );
    assert.equal(requiredConstraints.rowCount, 8, "durable constraints exist");

    const prematureFunctions = await inspection.query<{ proname: string }>(
      `SELECT p.proname
       FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'app'
         AND p.proname IN (
           'dispatcher_once',
           'executor_once',
           'maintenance_once'
         )`,
    );
    assert.deepEqual(
      prematureFunctions.rows,
      [],
      "Slice 1C.5 worker-runtime functions do not exist",
    );
  } finally {
    inspection.release();
  }

  const resetClient = await pool.connect();
  try {
    await withRole(resetClient, "cumulore_migration", () =>
      resetClient.query(
        "TRUNCATE endpoint_idempotency_records, external_operations, job_effects, job_actions, job_attempts, jobs, outbox_events, synthetic_operations, folder_closure, folders, workspace_members, workspaces, external_identities, users CASCADE",
      ),
    );
  } finally {
    resetClient.release();
  }

  const userA = await provisionIdentity(pool, {
    issuer: "https://fake.identity.local/",
    subject: "durable-a",
  });
  const userB = await provisionIdentity(pool, {
    issuer: "https://fake.identity.local/",
    subject: "durable-b",
  });
  const workspaceA = await createWorkspace(pool, userA, "Durable A");
  const workspaceB = await createWorkspace(pool, userB, "Durable B");

  const operationId = await withActorTransaction(
    pool,
    { userId: userA, workspaceId: workspaceA },
    async (client) => {
      const operation = await client.query<{ id: string }>(
        `INSERT INTO synthetic_operations (
           workspace_id, requested_by_user_id, scenario, input_version, configuration_version
         ) VALUES ($1, $2, 'database_effect', 1, 1)
         RETURNING id`,
        [workspaceA, userA],
      );
      await client.query(
        `INSERT INTO outbox_events (
           scope, workspace_id, event_type, schema_version, actor_type, actor_id,
           correlation_id, payload
         ) VALUES ('workspace', $1, 'durable.synthetic.requested', 1, 'user', $2, gen_random_uuid(), $3)`,
        [workspaceA, userA, { synthetic_operation_id: operation.rows[0]!.id }],
      );
      return operation.rows[0]!.id;
    },
  );

  await assert.rejects(() =>
    withActorTransaction(
      pool,
      { userId: userA, workspaceId: workspaceA },
      (client) =>
        client.query(
          `INSERT INTO synthetic_operations (
             workspace_id, requested_by_user_id, scenario, input_version, configuration_version
           ) VALUES ($1, $2, 'database_effect', 1, 1)`,
          [workspaceB, userA],
        ),
    ),
  );

  const worker = await pool.connect();
  try {
    const visibleA = await withRole(worker, "cumulore_worker", async () => {
      await setWorkerWorkspace(worker, workspaceA);
      return worker.query<{ id: string }>(
        "SELECT id FROM synthetic_operations",
      );
    });
    assert.deepEqual(visibleA.rows, [{ id: operationId }]);

    const visibleB = await withRole(worker, "cumulore_worker", async () => {
      await setWorkerWorkspace(worker, workspaceB);
      return worker.query<{ id: string }>(
        "SELECT id FROM synthetic_operations",
      );
    });
    assert.equal(visibleB.rowCount, 0, "worker RLS hides another workspace");

    await assert.rejects(() =>
      withRole(worker, "cumulore_worker", async () => {
        await setWorkerWorkspace(worker, workspaceA);
        await worker.query(
          "UPDATE synthetic_operations SET input_version = 2 WHERE id = $1",
          [operationId],
        );
      }),
    );
  } finally {
    worker.release();
  }

  const migration = await pool.connect();
  try {
    await withRole(migration, "cumulore_migration", async () => {
      const event = await migration.query<{ id: string }>(
        `SELECT id FROM outbox_events
         WHERE workspace_id = $1 AND event_type = 'durable.synthetic.requested'`,
        [workspaceA],
      );
      const jobId = "60000000-0000-4000-8000-000000000001";
      const attemptId = "70000000-0000-4000-8000-000000000001";
      await migration.query(
        `INSERT INTO jobs (
           id, workspace_id, event_id, event_type, event_schema_version,
           handler_name, handler_version, state, generation_attempt_count,
           lifetime_attempt_count, lease_generation, active_attempt_id,
           worker_owner, lease_expires_at
         ) VALUES (
           $1, $2, $3, 'durable.synthetic.requested', 1,
           'run_synthetic', 1, 'running', 1, 1, 1, $4,
           'schema-test-worker', now() + interval '60 seconds'
         )`,
        [jobId, workspaceA, event.rows[0]!.id, attemptId],
      );
      await migration.query(
        `INSERT INTO job_attempts (
           id, workspace_id, job_id, retry_generation,
           generation_attempt_number, lifetime_attempt_number,
           lease_generation, worker_owner
         ) VALUES ($1, $2, $3, 0, 1, 1, 1, 'schema-test-worker')`,
        [attemptId, workspaceA, jobId],
      );
    });

    await withRole(migration, "cumulore_migration", async () => {
      await migration.query(
        `UPDATE job_attempts
         SET ended_at = now(), outcome = 'succeeded', safe_usage_metadata = '{"rows":1}'::jsonb
         WHERE id = '70000000-0000-4000-8000-000000000001'`,
      );
    });
    await assert.rejects(() =>
      withRole(migration, "cumulore_migration", () =>
        migration.query(
          `UPDATE job_attempts SET safe_usage_metadata = '{"rows":2}'::jsonb
           WHERE id = '70000000-0000-4000-8000-000000000001'`,
        ),
      ),
    );

    await assert.rejects(() =>
      withRole(migration, "cumulore_migration", async () => {
        const foreignEvent = await migration.query<{ id: string }>(
          `INSERT INTO outbox_events (
             scope, workspace_id, event_type, schema_version, actor_type,
             correlation_id, payload
           ) VALUES (
             'workspace', $1, 'durable.synthetic.requested', 1, 'system',
             gen_random_uuid(), jsonb_build_object('synthetic_operation_id', gen_random_uuid())
           ) RETURNING id`,
          [workspaceB],
        );
        await migration.query(
          `INSERT INTO jobs (
             workspace_id, event_id, event_type, event_schema_version,
             handler_name, handler_version
           ) VALUES ($1, $2, 'durable.synthetic.requested', 1, 'run_synthetic', 1)`,
          [workspaceA, foreignEvent.rows[0]!.id],
        );
      }),
    );
  } finally {
    migration.release();
  }

  console.log("PostgreSQL durable schema integration tests passed.");
} finally {
  await pool.end();
}
