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
  await client.query(
    "CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
  );
  const allFiles = (await readdir(migrationsDirectory))
    .filter((file) => file.endsWith(".sql"))
    .sort();
  const migrationTarget = process.env.MIGRATION_TARGET;
  const targetIndex = migrationTarget
    ? allFiles.indexOf(migrationTarget)
    : allFiles.length - 1;
  if (migrationTarget && targetIndex < 0)
    throw new Error(
      `MIGRATION_TARGET does not name a migration: ${migrationTarget}`,
    );
  const files = allFiles.slice(0, targetIndex + 1);
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
  client.release();
  await pool.end();
}
