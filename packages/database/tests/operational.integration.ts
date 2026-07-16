import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { createPool } from "../src/index.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString)
  throw new Error("DATABASE_URL is required for integration tests");
const pool = createPool(connectionString);

async function seedTerminalJob(input: {
  workspaceId: string;
  state: "succeeded" | "cancelled" | "dead_letter";
  ageDays: number;
  attemptOutcomes?: Array<
    "succeeded" | "cancelled" | "retryable_failure" | "abandoned"
  >;
  unknownExternal?: boolean;
}): Promise<string> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL ROLE cumulore_migration");
    const event = await client.query<{ id: string }>(
      `INSERT INTO outbox_events (
         scope, workspace_id, event_type, schema_version, actor_type,
         correlation_id, payload, dispatch_completed_at, dispatched_handler_count
       ) VALUES (
         'workspace', $1, 'durable.synthetic.requested', 1, 'system',
         $2, '{}'::jsonb, clock_timestamp() - make_interval(days => $3), 1
       ) RETURNING id`,
      [input.workspaceId, randomUUID(), input.ageDays],
    );
    const outcomes = input.attemptOutcomes ?? [];
    const job = await client.query<{ id: string }>(
      `INSERT INTO jobs (
         workspace_id, event_id, event_type, event_schema_version,
         handler_name, handler_version, state, available_at, terminal_at,
         generation_attempt_count, lifetime_attempt_count, lease_generation,
         last_error_code
       ) VALUES (
         $1, $2, 'durable.synthetic.requested', 1, 'run_synthetic', 1,
         $3::durable_job_state, clock_timestamp() - make_interval(days => $4),
         clock_timestamp() - make_interval(days => $4),
         $5::integer, $5::integer, $5::bigint,
         CASE WHEN $3::durable_job_state = 'dead_letter' THEN 'terminal_failure' ELSE NULL END
       ) RETURNING id`,
      [
        input.workspaceId,
        event.rows[0]!.id,
        input.state,
        input.ageDays,
        outcomes.length,
      ],
    );
    let lastAttemptId: string | undefined;
    for (const [index, outcome] of outcomes.entries()) {
      const retryClassification = ["retryable_failure", "abandoned"].includes(
        outcome,
      )
        ? "retryable"
        : null;
      const attempt = await client.query<{ id: string }>(
        `INSERT INTO job_attempts (
           workspace_id, job_id, retry_generation, generation_attempt_number,
           lifetime_attempt_number, lease_generation, worker_owner, started_at,
           ended_at, outcome, retry_classification, safe_error_code
         ) VALUES (
           $1, $2, 0, $3::integer, $3::integer, $3::bigint, 'retention-test',
           clock_timestamp() - make_interval(days => $4),
           clock_timestamp() - make_interval(days => $4), $5::job_attempt_outcome, $6::job_retry_classification,
           CASE WHEN $5::job_attempt_outcome IN ('retryable_failure', 'abandoned') THEN 'retryable_test' ELSE NULL END
         ) RETURNING id`,
        [
          input.workspaceId,
          job.rows[0]!.id,
          index + 1,
          input.ageDays,
          outcome,
          retryClassification,
        ],
      );
      lastAttemptId = attempt.rows[0]!.id;
    }
    if (input.unknownExternal && lastAttemptId) {
      await client.query(
        `INSERT INTO external_operations (
           workspace_id, job_id, attempt_id, logical_operation_id,
           sequence_number, provider_name, operation_name,
           provider_idempotency_key, request_hash, state, next_reconcile_at
         ) VALUES (
           $1, $2, $3, $4, 0, 'fake', 'invoke', $5,
           digest($5, 'sha256'), 'unknown', clock_timestamp() - interval '1 day'
         )`,
        [
          input.workspaceId,
          job.rows[0]!.id,
          lastAttemptId,
          randomUUID(),
          `retention-${randomUUID()}`,
        ],
      );
    }
    await client.query("COMMIT");
    return job.rows[0]!.id;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

try {
  const migrationMetadata = await pool.query<{
    incomplete: string;
  }>(
    `SELECT
       count(*) FILTER (WHERE checksum IS NULL OR char_length(checksum) <> 64 OR size_bytes <= 0) AS incomplete
     FROM schema_migrations`,
  );
  const ownerRows = await pool.query<{
    table_owner: string;
    schema_owner: string;
  }>(
    `SELECT
       pg_get_userbyid(c.relowner) AS table_owner,
       pg_get_userbyid(n.nspowner) AS schema_owner
     FROM pg_class c
     JOIN pg_namespace n ON n.nspname = 'app'
     WHERE c.oid = 'schema_migrations'::regclass`,
  );
  assert.equal(migrationMetadata.rows[0]!.incomplete, "0");
  assert.deepEqual(ownerRows.rows, [
    { table_owner: "cumulore_migration", schema_owner: "cumulore_migration" },
  ]);

  const extensionResult = await pool.query<{ extname: string }>(
    "SELECT extname FROM pg_extension WHERE extname IN ('vector', 'pg_stat_statements') ORDER BY extname",
  );
  assert.deepEqual(
    extensionResult.rows.map((row) => row.extname),
    ["pg_stat_statements", "vector"],
    "the isolated operational database enables pgvector and pg_stat_statements",
  );

  const owner = await pool.query<{ owner: string }>(
    `SELECT pg_get_userbyid(proowner) AS owner
     FROM pg_proc
     WHERE oid = 'app.operational_metrics()'::regprocedure`,
  );
  assert.deepEqual(owner.rows, [{ owner: "cumulore_migration" }]);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL ROLE cumulore_worker");
    const metrics = await client.query<Record<string, string | number>>(
      "SELECT * FROM app.operational_metrics()",
    );
    assert.equal(metrics.rowCount, 1);
    for (const value of Object.values(metrics.rows[0]!))
      assert.ok(Number(value) >= 0, "operational metrics are non-negative");
    await client.query("COMMIT");

    await client.query("BEGIN");
    await client.query("SET LOCAL ROLE cumulore_web");
    await assert.rejects(() =>
      client.query("SELECT * FROM app.operational_metrics()"),
    );
    await client.query("ROLLBACK");
  } finally {
    client.release();
  }

  const migration = await pool.connect();
  try {
    await migration.query("BEGIN");
    await migration.query("SET LOCAL ROLE cumulore_migration");
    const user = await migration.query<{ id: string }>(
      "INSERT INTO users DEFAULT VALUES RETURNING id",
    );
    const workspace = await migration.query<{ id: string }>(
      "INSERT INTO workspaces (name) VALUES ('Retention tests') RETURNING id",
    );
    await migration.query(
      "INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'owner')",
      [workspace.rows[0]!.id, user.rows[0]!.id],
    );
    await migration.query("COMMIT");

    const succeeded = await seedTerminalJob({
      workspaceId: workspace.rows[0]!.id,
      state: "succeeded",
      ageDays: 31,
      attemptOutcomes: ["succeeded"],
    });
    const retriedTooYoung = await seedTerminalJob({
      workspaceId: workspace.rows[0]!.id,
      state: "succeeded",
      ageDays: 31,
      attemptOutcomes: ["retryable_failure", "succeeded"],
    });
    const retriedOld = await seedTerminalJob({
      workspaceId: workspace.rows[0]!.id,
      state: "succeeded",
      ageDays: 91,
      attemptOutcomes: ["abandoned", "succeeded"],
    });
    const cancelled = await seedTerminalJob({
      workspaceId: workspace.rows[0]!.id,
      state: "cancelled",
      ageDays: 31,
    });
    const deadLetter = await seedTerminalJob({
      workspaceId: workspace.rows[0]!.id,
      state: "dead_letter",
      ageDays: 120,
      attemptOutcomes: ["retryable_failure"],
    });
    const unknown = await seedTerminalJob({
      workspaceId: workspace.rows[0]!.id,
      state: "succeeded",
      ageDays: 120,
      attemptOutcomes: ["succeeded"],
      unknownExternal: true,
    });

    await migration.query("BEGIN");
    await migration.query("SET LOCAL ROLE cumulore_migration");
    await assert.rejects(
      () =>
        migration.query("DELETE FROM job_attempts WHERE job_id = $1", [
          succeeded,
        ]),
      /job attempt history cannot be deleted/,
      "closed attempts remain immutable outside the cleanup capability",
    );
    await migration.query("ROLLBACK");

    await migration.query("BEGIN");
    await migration.query("SET LOCAL ROLE cumulore_worker");
    await assert.rejects(() =>
      migration.query("SELECT app.cleanup_durable_processing(0)"),
    );
    await migration.query("ROLLBACK");

    await migration.query("BEGIN");
    await migration.query("SET LOCAL ROLE cumulore_worker");
    const cleanup = await migration.query<{
      cleanup_durable_processing: number;
    }>("SELECT app.cleanup_durable_processing(100)");
    assert.ok(cleanup.rows[0]!.cleanup_durable_processing >= 3);
    await migration.query("COMMIT");

    const remaining = await pool.query<{ id: string }>(
      "SELECT id FROM jobs WHERE id = ANY($1::uuid[]) ORDER BY id",
      [
        [
          succeeded,
          retriedTooYoung,
          retriedOld,
          cancelled,
          deadLetter,
          unknown,
        ],
      ],
    );
    assert.deepEqual(
      new Set(remaining.rows.map((row) => row.id)),
      new Set([retriedTooYoung, deadLetter, unknown]),
      "cleanup uses 30/90-day retention and preserves dead letters and unresolved external work",
    );
  } finally {
    await migration.query("ROLLBACK");
    migration.release();
  }

  console.log("PostgreSQL operational integration tests passed.");
} finally {
  await pool.end();
}
