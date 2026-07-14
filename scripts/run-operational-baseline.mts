import { mkdir, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { resolve } from "node:path";

import { Client } from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");
if (process.env.CUMULORE_ALLOW_SYNTHETIC_BASELINE !== "1")
  throw new Error(
    "Set CUMULORE_ALLOW_SYNTHETIC_BASELINE=1 only for a local or isolated non-production database",
  );

function percentile(samples: number[], value: number): number {
  const ordered = [...samples].sort((left, right) => left - right);
  const index = Math.max(0, Math.ceil((value / 100) * ordered.length) - 1);
  return Number(ordered[index]!.toFixed(3));
}

async function measure(
  count: number,
  action: () => Promise<unknown>,
): Promise<{ p50_ms: number; p95_ms: number; p99_ms: number }> {
  const samples: number[] = [];
  for (let index = 0; index < count; index += 1) {
    const started = performance.now();
    await action();
    samples.push(performance.now() - started);
  }
  return {
    p50_ms: percentile(samples, 50),
    p95_ms: percentile(samples, 95),
    p99_ms: percentile(samples, 99),
  };
}

const client = new Client({ connectionString: databaseUrl });
await client.connect();
try {
  await client.query("BEGIN");
  await client.query("SET LOCAL statement_timeout = '5min'");
  await client.query("SET LOCAL lock_timeout = '2s'");
  await client.query("SET LOCAL ROLE cumulore_migration");
  const fixture = await client.query<{
    user_id: string;
    workspace_id: string;
    operation_id: string;
  }>(`WITH new_user AS (
       INSERT INTO users DEFAULT VALUES RETURNING id
     ), new_workspace AS (
       INSERT INTO workspaces (name) VALUES ('Synthetic performance baseline') RETURNING id
     ), membership AS (
       INSERT INTO workspace_members (workspace_id, user_id, role)
       SELECT new_workspace.id, new_user.id, 'owner'
       FROM new_workspace CROSS JOIN new_user
     ), operation AS (
       INSERT INTO synthetic_operations (
         workspace_id, requested_by_user_id, scenario, input_version, configuration_version
       )
       SELECT new_workspace.id, new_user.id, 'database_effect', 1, 1
       FROM new_workspace CROSS JOIN new_user
       RETURNING id
     )
     SELECT new_user.id AS user_id, new_workspace.id AS workspace_id,
       operation.id AS operation_id
     FROM new_user CROSS JOIN new_workspace CROSS JOIN operation`);
  const {
    user_id: userId,
    workspace_id: workspaceId,
    operation_id: operationId,
  } = fixture.rows[0]!;
  await client.query(
    `INSERT INTO outbox_events (
       scope, workspace_id, event_type, schema_version, actor_type, actor_id,
       correlation_id, payload, occurred_at
     )
     SELECT 'workspace', $1, 'durable.synthetic.requested', 1, 'user', $2,
       gen_random_uuid(), jsonb_build_object('synthetic_operation_id', $3::uuid),
       clock_timestamp() + (sequence * interval '1 microsecond')
     FROM generate_series(1, 10000) AS sequence`,
    [workspaceId, userId, operationId],
  );
  await client.query("SET LOCAL ROLE cumulore_worker");
  const dispatch = await measure(100, () =>
    client.query("SELECT app.dispatch_outbox(100)"),
  );
  const claim = await measure(100, () =>
    client.query("SELECT * FROM app.claim_jobs('baseline-worker', 1, 60)"),
  );
  await client.query("SELECT set_config('app.workspace_id', $1, true)", [
    workspaceId,
  ]);
  const queryPlan = await client.query(
    `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
     SELECT id FROM jobs
     WHERE state IN ('pending', 'retry_wait') AND available_at <= clock_timestamp()
     ORDER BY available_at, created_at, id
     LIMIT 10`,
  );
  const result = {
    generated_at: new Date().toISOString(),
    fixture: { eligible_events: 10000, dispatched_jobs: 10000 },
    soft_budgets_ms: { dispatch_batch_p95: 100, claim_single_p95: 100 },
    measurements: { dispatch_batch_100: dispatch, claim_single: claim },
    within_soft_budget: {
      dispatch_batch_p95: dispatch.p95_ms <= 100,
      claim_single_p95: claim.p95_ms <= 100,
    },
    claim_query_plan: queryPlan.rows[0]!["QUERY PLAN"],
  };
  await client.query("ROLLBACK");
  const outputDirectory = resolve(".local");
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(
    resolve(outputDirectory, "operational-baseline.json"),
    `${JSON.stringify(result, null, 2)}\n`,
    "utf8",
  );
  console.log(JSON.stringify(result.within_soft_budget));
  console.log("Detailed baseline written to .local/operational-baseline.json");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  await client.end();
}
