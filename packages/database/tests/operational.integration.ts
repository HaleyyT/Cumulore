import assert from "node:assert/strict";

import { createPool } from "../src/index.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString)
  throw new Error("DATABASE_URL is required for integration tests");
const pool = createPool(connectionString);

try {
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

  console.log("PostgreSQL operational integration tests passed.");
} finally {
  await pool.end();
}
