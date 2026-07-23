import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

import {
  createPool,
  createSyntheticOperationAndEvent,
  createWorkspace,
  provisionIdentity,
  withActorTransaction,
} from "../packages/database/src/index.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString)
  throw new Error("DATABASE_URL is required for release exercises");

const pool = createPool(connectionString);

type ClaimedJob = {
  attempt_id: string;
  job_id: string;
  lease_generation: string;
  workspace_id: string;
};

async function createOperation(input: {
  userId: string;
  workspaceId: string;
  scenario: "cooperative_wait" | "database_effect";
}): Promise<string> {
  const operation = await withActorTransaction(
    pool,
    { userId: input.userId, workspaceId: input.workspaceId },
    (client) =>
      createSyntheticOperationAndEvent(client, {
        workspaceId: input.workspaceId,
        requestedByUserId: input.userId,
        scenario: input.scenario,
        inputVersion: 1,
        configurationVersion: 1,
        correlationId: randomUUID(),
      }),
  );
  return operation.operationId;
}

async function dispatch(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL ROLE cumulore_worker");
    await client.query("SELECT app.dispatch_outbox(50)");
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function jobState(operationId: string): Promise<string | undefined> {
  const result = await pool.query<{ state: string }>(
    `SELECT job.state
       FROM jobs job
       JOIN outbox_events event ON event.id = job.event_id
      WHERE event.payload->>'synthetic_operation_id' = $1`,
    [operationId],
  );
  return result.rows[0]?.state;
}

async function waitForRunning(operationId: string): Promise<void> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if ((await jobState(operationId)) === "running") return;
    await delay(25);
  }
  throw new Error("cooperative worker never claimed the release-exercise job");
}

async function waitForExit(child: ReturnType<typeof spawn>): Promise<void> {
  await Promise.race([
    new Promise<void>((resolve, reject) => {
      child.once("error", reject);
      child.once("exit", (code, signal) => {
        if (code === 0 && signal === null) resolve();
        else
          reject(
            new Error(
              `cooperative worker stopped unexpectedly${signal ? ` (${signal})` : ` with exit code ${code ?? "unknown"}`}`,
            ),
          );
      });
    }),
    delay(10_000).then(() => {
      child.kill("SIGKILL");
      throw new Error("cooperative worker did not stop after SIGTERM");
    }),
  ]);
}

async function claimForExpiry(workspaceId: string): Promise<ClaimedJob> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL ROLE cumulore_worker");
    await client.query("SELECT set_config('app.workspace_id', $1, true)", [
      workspaceId,
    ]);
    const result = await client.query<ClaimedJob>(
      "SELECT * FROM app.claim_jobs($1, 1, 60)",
      ["release-exercise-stale-worker"],
    );
    await client.query("COMMIT");
    return result.rows[0]!;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function completeClaim(input: {
  claim: ClaimedJob;
  workerOwner: string;
  workspaceId: string;
}): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL ROLE cumulore_worker");
    await client.query("SELECT set_config('app.workspace_id', $1, true)", [
      input.workspaceId,
    ]);
    const completion = await client.query<{ completed: boolean }>(
      "SELECT app.complete_job($1, $2, $3, $4) AS completed",
      [
        input.claim.job_id,
        input.claim.attempt_id,
        input.workerOwner,
        input.claim.lease_generation,
      ],
    );
    await client.query("COMMIT");
    return completion.rows[0]?.completed === true;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function cleanupDurableProcessing(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL ROLE cumulore_worker");
    await client.query("SELECT app.cleanup_durable_processing(100)");
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function releaseExercise(): Promise<void> {
  const userId = await provisionIdentity(pool, {
    issuer: "https://fake.identity.local/",
    subject: `release-exercise-${randomUUID()}`,
  });
  const workspaceId = await createWorkspace(pool, userId, "Release exercise");

  const cooperativeOperationId = await createOperation({
    userId,
    workspaceId,
    scenario: "cooperative_wait",
  });
  await dispatch();
  const worker = spawn("python3", ["-m", "cumulore_worker", "executor"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      CUMULORE_HEARTBEAT_SECONDS: "1",
      CUMULORE_LEASE_SECONDS: "5",
      CUMULORE_SHUTDOWN_GRACE_SECONDS: "3",
      CUMULORE_SYNTHETIC_WAIT_SECONDS: "1",
      CUMULORE_WORKER_OWNER: "release-exercise-cooperative",
    },
    stdio: "inherit",
  });
  await waitForRunning(cooperativeOperationId);
  worker.kill("SIGTERM");
  await waitForExit(worker);
  assert.equal(
    await jobState(cooperativeOperationId),
    "succeeded",
    "a SIGTERM allows cooperative work to finish within the shutdown grace period",
  );

  const expiryOperationId = await createOperation({
    userId,
    workspaceId,
    scenario: "database_effect",
  });
  await dispatch();
  const claimed = await claimForExpiry(workspaceId);
  const migration = await pool.connect();
  try {
    await migration.query("BEGIN");
    await migration.query("SET LOCAL ROLE cumulore_migration");
    await migration.query(
      "UPDATE jobs SET lease_expires_at = clock_timestamp() - interval '1 second' WHERE id = $1",
      [claimed.job_id],
    );
    await migration.query("COMMIT");
  } catch (error) {
    await migration.query("ROLLBACK");
    throw error;
  } finally {
    migration.release();
  }
  const workerClient = await pool.connect();
  try {
    await workerClient.query("BEGIN");
    await workerClient.query("SET LOCAL ROLE cumulore_worker");
    await workerClient.query(
      "SELECT set_config('app.workspace_id', $1, true)",
      [workspaceId],
    );
    const reclaimed = await workerClient.query<{ reclaimed: number }>(
      "SELECT app.reclaim_expired_jobs() AS reclaimed",
    );
    assert.equal(reclaimed.rows[0]?.reclaimed, 1);
    const staleCompletion = await workerClient.query<{ completed: boolean }>(
      "SELECT app.complete_job($1, $2, $3, $4) AS completed",
      [
        claimed.job_id,
        claimed.attempt_id,
        "release-exercise-stale-worker",
        claimed.lease_generation,
      ],
    );
    assert.equal(staleCompletion.rows[0]?.completed, false);
    await workerClient.query("COMMIT");
  } catch (error) {
    await workerClient.query("ROLLBACK");
    throw error;
  } finally {
    workerClient.release();
  }

  assert.equal(
    await jobState(expiryOperationId),
    "retry_wait",
    "reclaim returns the expired job to a claimable state",
  );
  const freshClaim = await claimForExpiry(workspaceId);
  assert.equal(freshClaim.job_id, claimed.job_id);
  assert.equal(
    await completeClaim({
      claim: freshClaim,
      workerOwner: "release-exercise-stale-worker",
      workspaceId,
    }),
    true,
  );
  assert.equal(await jobState(expiryOperationId), "succeeded");

  const cleanupRaceOperationId = await createOperation({
    userId,
    workspaceId,
    scenario: "database_effect",
  });
  await dispatch();
  const cleanupRaceClaim = await claimForExpiry(workspaceId);
  const [completedDuringCleanup] = await Promise.all([
    completeClaim({
      claim: cleanupRaceClaim,
      workerOwner: "release-exercise-stale-worker",
      workspaceId,
    }),
    cleanupDurableProcessing(),
  ]);
  assert.equal(completedDuringCleanup, true);
  assert.equal(
    await jobState(cleanupRaceOperationId),
    "succeeded",
    "cleanup cannot remove a job completing in a concurrent transaction",
  );
}

try {
  await releaseExercise();
  console.log(
    "Release graceful-shutdown, expiry, reclaim, and stale-fence exercises passed.",
  );
} finally {
  await pool.end();
}
