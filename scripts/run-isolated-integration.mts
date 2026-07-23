import { spawn } from "node:child_process";

import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { Client } from "pg";

const POSTGRES_IMAGE =
  "pgvector/pgvector:0.8.1-pg16@sha256:33198da2828a14c30348d2ccb4750833d5ed9a44c88d840a0e523d7417120337";

async function runStep(
  label: string,
  command: string,
  args: string[],
  environment: NodeJS.ProcessEnv,
): Promise<void> {
  console.log(`\n[isolated integration] ${label}`);
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: environment,
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolve();
      else
        reject(
          new Error(
            `${label} failed${signal ? ` after ${signal}` : ` with exit code ${code ?? "unknown"}`}`,
          ),
        );
    });
  });
}

async function runExpectedFailure(
  label: string,
  command: string,
  args: string[],
  environment: NodeJS.ProcessEnv,
  expectedOutput: string,
): Promise<void> {
  console.log(`\n[isolated integration] ${label}`);
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: environment,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code !== 0 && signal === null && output.includes(expectedOutput)) {
        resolve();
        return;
      }
      reject(
        new Error(
          `${label} did not reject the invalid state as expected${signal ? ` (${signal})` : ""}`,
        ),
      );
    });
  });
}

console.log(`[isolated integration] starting ${POSTGRES_IMAGE}`);
const postgres = await new PostgreSqlContainer(POSTGRES_IMAGE)
  .withDatabase("cumulore")
  .withUsername("cumulore")
  .withPassword("cumulore_test_only")
  .withCommand([
    "postgres",
    "-c",
    "shared_preload_libraries=pg_stat_statements",
  ])
  .start();

try {
  const databaseUrl = postgres.getConnectionUri();
  const environment = {
    ...process.env,
    DATABASE_URL: databaseUrl,
    IDENTITY_PROVIDER: "fake",
  };
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query("CREATE EXTENSION IF NOT EXISTS vector");
    await client.query("CREATE EXTENSION IF NOT EXISTS pg_stat_statements");
    const extensions = await client.query<{ extname: string }>(
      "SELECT extname FROM pg_extension WHERE extname IN ('vector', 'pg_stat_statements') ORDER BY extname",
    );
    if (extensions.rowCount !== 2)
      throw new Error("pgvector and pg_stat_statements must both be available");
    await client.query("CREATE DATABASE cumulore_upgrade");
  } finally {
    await client.end();
  }

  const upgradeUrl = new URL(databaseUrl);
  upgradeUrl.pathname = "/cumulore_upgrade";
  const upgradeClient = new Client({ connectionString: upgradeUrl.toString() });
  await upgradeClient.connect();
  try {
    await upgradeClient.query("CREATE EXTENSION IF NOT EXISTS vector");
    await upgradeClient.query(
      "CREATE EXTENSION IF NOT EXISTS pg_stat_statements",
    );
  } finally {
    await upgradeClient.end();
  }

  await runStep(
    "migration upgrade fixture through Milestone 2A",
    "pnpm",
    ["db:migrate"],
    {
      ...environment,
      DATABASE_URL: upgradeUrl.toString(),
      MIGRATION_TARGET: "009_ingestion.sql",
    },
  );
  await runStep("migration upgrade to current schema", "pnpm", ["db:migrate"], {
    ...environment,
    DATABASE_URL: upgradeUrl.toString(),
  });

  await runStep("fresh migrations", "pnpm", ["db:migrate"], environment);
  await runStep(
    "TypeScript PostgreSQL suites",
    "pnpm",
    ["test:integration"],
    environment,
  );
  await runStep(
    "Python integration suites",
    "python3",
    ["-m", "pytest", "services/worker/tests"],
    environment,
  );
  await runStep("worker smoke mode", "pnpm", ["worker:smoke"], environment);

  const checksumClient = new Client({
    connectionString: upgradeUrl.toString(),
  });
  await checksumClient.connect();
  try {
    await checksumClient.query(
      "UPDATE schema_migrations SET checksum = repeat('0', 64) WHERE name = '001_identity_tenancy.sql'",
    );
  } finally {
    await checksumClient.end();
  }
  await runExpectedFailure(
    "migration checksum rejection",
    "pnpm",
    ["db:migrate"],
    { ...environment, DATABASE_URL: upgradeUrl.toString() },
    "Applied migration checksum mismatch: 001_identity_tenancy.sql",
  );
  console.log("\n[isolated integration] all checks passed");
} finally {
  await postgres.stop();
}
