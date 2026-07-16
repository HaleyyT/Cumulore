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
        correlationId: randomUUID(),
      }),
  );

  await runWorker("dispatcher");
  await runWorker("executor");
  await runWorker("maintenance");

  const result = await pool.query<{
    state: string;
    attempt_outcome: string;
    effect_count: string;
  }>(
    `SELECT job.state, attempt.outcome AS attempt_outcome,
            (SELECT count(*) FROM job_effects effect WHERE effect.job_id = job.id) AS effect_count
     FROM jobs job
     JOIN outbox_events event ON event.id = job.event_id
     JOIN job_attempts attempt ON attempt.job_id = job.id
     WHERE event.payload->>'synthetic_operation_id' = $1`,
    [created.operationId],
  );
  assert.deepEqual(result.rows, [
    { state: "succeeded", attempt_outcome: "succeeded", effect_count: "1" },
  ]);
  console.log("Worker end-to-end smoke passed.");
} finally {
  await pool.end();
}
