import { readdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
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
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       name text PRIMARY KEY,
       checksum text,
       size_bytes bigint,
       applied_at timestamptz NOT NULL DEFAULT now()
     )`,
  );
  await client.query(
    "ALTER TABLE schema_migrations ADD COLUMN IF NOT EXISTS checksum text, ADD COLUMN IF NOT EXISTS size_bytes bigint",
  );
  await client.query(
    "SELECT pg_advisory_lock(hashtextextended(current_database() || ':cumulore-schema-migrations', 0))",
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
    const sql = await readFile(join(migrationsDirectory, file), "utf8");
    const checksum = createHash("sha256").update(sql).digest("hex");
    const sizeBytes = Buffer.byteLength(sql);
    const applied = await client.query<{
      checksum: string | null;
      size_bytes: string | null;
    }>("SELECT checksum, size_bytes FROM schema_migrations WHERE name = $1", [
      file,
    ]);
    if (applied.rowCount) {
      const record = applied.rows[0]!;
      if (record.checksum === null && record.size_bytes === null) {
        await client.query(
          "UPDATE schema_migrations SET checksum = $2, size_bytes = $3 WHERE name = $1 AND checksum IS NULL AND size_bytes IS NULL",
          [file, checksum, sizeBytes],
        );
      } else if (
        record.checksum !== checksum ||
        Number(record.size_bytes) !== sizeBytes
      ) {
        throw new Error(`Applied migration checksum mismatch: ${file}`);
      }
      continue;
    }
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query(
        "INSERT INTO schema_migrations (name, checksum, size_bytes) VALUES ($1, $2, $3)",
        [file, checksum, sizeBytes],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }
} finally {
  await client.query(
    "SELECT pg_advisory_unlock(hashtextextended(current_database() || ':cumulore-schema-migrations', 0))",
  );
  client.release();
  await pool.end();
}
