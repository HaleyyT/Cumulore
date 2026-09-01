import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";

import {
  createPool,
  createSyntheticOperationAndEvent,
  createWorkspace,
  provisionIdentity,
  withActorTransaction,
} from "../packages/database/src/index.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString)
  throw new Error("DATABASE_URL is required for worker smoke");

async function runWorker(role: "dispatcher" | "executor" | "maintenance") {
  await new Promise<void>((resolve, reject) => {
    const child = spawn("python3", ["-m", "cumulore_worker", role, "--once"], {
      cwd: process.cwd(),
      env: process.env,
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolve();
      else
        reject(
          new Error(
            `worker ${role} smoke failed${signal ? ` after ${signal}` : ` with exit code ${code ?? "unknown"}`}`,
          ),
        );
    });
  });
}

const pool = createPool(connectionString);
try {
  const userId = await provisionIdentity(pool, {
    issuer: "https://fake.identity.local/",
    subject: `worker-smoke-${randomUUID()}`,
  });
  const workspaceId = await createWorkspace(pool, userId, "Worker smoke");
  const scenarios = [
    "database_effect",
    "external_success",
    "unknown_then_success",
    "retryable_failure",
    "non_retryable_failure",
  ] as const;
  type Scenario = (typeof scenarios)[number];

  async function executeScenario(scenario: Scenario) {
    const created = await withActorTransaction(
      pool,
      { userId, workspaceId },
      (client) =>
        createSyntheticOperationAndEvent(client, {
          workspaceId,
          requestedByUserId: userId,
          scenario,
          inputVersion: 1,
          configurationVersion: 1,
          correlationId: randomUUID(),
        }),
    );
    await runWorker("dispatcher");

    let state = "pending";
    for (let cycle = 0; cycle < 8; cycle += 1) {
      await runWorker("executor");
      await runWorker("maintenance");
      const job = await pool.query<{ state: string }>(
        `SELECT job.state
         FROM jobs job
         JOIN outbox_events event ON event.id = job.event_id
         WHERE event.payload->>'synthetic_operation_id' = $1`,
        [created.operationId],
      );
      state = job.rows[0]!.state;
      if (["succeeded", "dead_letter", "cancelled"].includes(state)) break;
    }
    return { operationId: created.operationId, state };
  }

  const results = new Map<Scenario, { operationId: string; state: string }>();
  for (const scenario of scenarios) {
    results.set(scenario, await executeScenario(scenario));
  }

  const summary = await pool.query<{
    scenario: Scenario;
    state: string;
    attempt_count: string;
    succeeded_attempts: string;
    effect_count: string;
    external_succeeded: string;
    external_failed: string;
    external_unknown: string;
    provider_key_count: string;
  }>(
    `SELECT operation.scenario, job.state,
       (SELECT count(*) FROM job_attempts attempt WHERE attempt.job_id = job.id) AS attempt_count,
       (SELECT count(*) FROM job_attempts attempt WHERE attempt.job_id = job.id AND attempt.outcome = 'succeeded') AS succeeded_attempts,
       (SELECT count(*) FROM job_effects effect WHERE effect.job_id = job.id) AS effect_count,
       (SELECT count(*) FROM external_operations external WHERE external.job_id = job.id AND external.state = 'succeeded') AS external_succeeded,
       (SELECT count(*) FROM external_operations external WHERE external.job_id = job.id AND external.state = 'failed') AS external_failed,
       (SELECT count(*) FROM external_operations external WHERE external.job_id = job.id AND external.state = 'unknown') AS external_unknown,
       (SELECT count(DISTINCT external.provider_idempotency_key) FROM external_operations external WHERE external.job_id = job.id) AS provider_key_count
     FROM synthetic_operations operation
     JOIN outbox_events event ON event.payload->>'synthetic_operation_id' = operation.id::text
     JOIN jobs job ON job.event_id = event.id
     WHERE operation.id = ANY($1::uuid[])
     ORDER BY operation.scenario`,
    [[...results.values()].map((result) => result.operationId)],
  );
  const byScenario = new Map(summary.rows.map((row) => [row.scenario, row]));

  assert.deepEqual(byScenario.get("database_effect"), {
    scenario: "database_effect",
    state: "succeeded",
    attempt_count: "1",
    succeeded_attempts: "1",
    effect_count: "1",
    external_succeeded: "0",
    external_failed: "0",
    external_unknown: "0",
    provider_key_count: "0",
  });
  assert.deepEqual(byScenario.get("external_success"), {
    scenario: "external_success",
    state: "succeeded",
    attempt_count: "1",
    succeeded_attempts: "1",
    effect_count: "0",
    external_succeeded: "1",
    external_failed: "0",
    external_unknown: "0",
    provider_key_count: "1",
  });
  assert.deepEqual(byScenario.get("unknown_then_success"), {
    scenario: "unknown_then_success",
    state: "succeeded",
    attempt_count: "2",
    succeeded_attempts: "1",
    effect_count: "0",
    external_succeeded: "1",
    external_failed: "0",
    external_unknown: "0",
    provider_key_count: "1",
  });
  assert.deepEqual(byScenario.get("retryable_failure"), {
    scenario: "retryable_failure",
    state: "dead_letter",
    attempt_count: "5",
    succeeded_attempts: "0",
    effect_count: "0",
    external_succeeded: "0",
    external_failed: "5",
    external_unknown: "0",
    provider_key_count: "1",
  });
  assert.deepEqual(byScenario.get("non_retryable_failure"), {
    scenario: "non_retryable_failure",
    state: "dead_letter",
    attempt_count: "1",
    succeeded_attempts: "0",
    effect_count: "0",
    external_succeeded: "0",
    external_failed: "1",
    external_unknown: "0",
    provider_key_count: "1",
  });
  console.log("Worker database and fake-external end-to-end smoke passed.");
} finally {
  await pool.end();
}
