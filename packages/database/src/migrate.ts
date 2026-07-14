import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { createPool } from "./index.js";

const migrationsDirectory = join(
  dirname(fileURLToPath(import.meta.url)),
  "../migrations",
);
const connectionString = process.env.DATABASE_URL;
if (!connectionString)
  throw new Error("DATABASE_URL is required for migrations");

const pool = createPool(connectionString);
const client = await pool.connect();
try {
  // Migration files create reviewed objects as the no-login migration role.
  // The session role must remain elevated for schema_migrations as well, so
  // every migration and its bookkeeping row share the same ownership boundary.
  await client.query("SET ROLE cumulore_migration");
  await client.query(
    "CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
  );
  const files = (await readdir(migrationsDirectory))
    .filter((file) => file.endsWith(".sql"))
    .sort();
  for (const file of files) {
    const applied = await client.query(
      "SELECT 1 FROM schema_migrations WHERE name = $1",
      [file],
    );
    if (applied.rowCount) continue;
    await client.query("BEGIN");
    try {
      await client.query(
        await readFile(join(migrationsDirectory, file), "utf8"),
      );
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [
        file,
      ]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }
} finally {
  await client.query("RESET ROLE");
  client.release();
  await pool.end();
}
