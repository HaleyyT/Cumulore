import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const source = existsSync(resolve(root, ".env.local"))
  ? ".env.local"
  : ".env.example";
const values = Object.fromEntries(
  readFileSync(resolve(root, source), "utf8")
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => line.split("=", 2)),
);
const required = [
  "POSTGRES_DB",
  "POSTGRES_USER",
  "POSTGRES_PASSWORD",
  "POSTGRES_PORT",
  "MINIO_ROOT_USER",
  "MINIO_ROOT_PASSWORD",
  "MINIO_PORT",
  "S3_ENDPOINT",
  "S3_REGION",
  "S3_BUCKET",
];
const missing = required.filter((key) => !values[key]);
if (missing.length > 0)
  throw new Error(`${source} is missing required keys: ${missing.join(", ")}`);
if (
  !Number.isInteger(Number(values.POSTGRES_PORT)) ||
  !Number.isInteger(Number(values.MINIO_PORT))
)
  throw new Error("POSTGRES_PORT and MINIO_PORT must be integer ports.");
if (!URL.canParse(values.S3_ENDPOINT))
  throw new Error("S3_ENDPOINT must be an absolute URL.");
console.log(`Environment configuration validation passed (${source}).`);
