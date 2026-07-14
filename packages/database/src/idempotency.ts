import { createHash } from "node:crypto";

import type { Pool, PoolClient } from "pg";

import {
  createSyntheticOperationAndEvent,
  type CreateSyntheticOperationInput,
} from "./durable-processing.js";
import { ApplicationError } from "./errors.js";
import type { ActorContext } from "./index.js";

export type IdempotentCommandResult<TResponse> =
  | { kind: "executed"; response: TResponse }
  | { kind: "replayed"; response: TResponse }
  | { kind: "in_progress" };

export class IdempotencyConflictError extends ApplicationError {
  constructor() {
    super(
      "idempotency_conflict",
      "The idempotency key was already used with a different request",
    );
    this.name = "IdempotencyConflictError";
  }
}

type JsonObject = Record<string, unknown>;

function canonicalize(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value))
      throw new TypeError("non-finite numbers are unsupported");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (typeof value === "object") {
    if (Object.getPrototypeOf(value) !== Object.prototype)
      throw new TypeError("only plain JSON objects are supported");
    return `{${Object.keys(value)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${canonicalize((value as JsonObject)[key])}`,
      )
      .join(",")}}`;
  }
  throw new TypeError("unsupported value in idempotency request");
}

export function canonicalRequestHash(request: unknown): Buffer {
  return createHash("sha256").update(canonicalize(request)).digest();
}

function assertSafeResponse(
  value: unknown,
  path = "response",
): asserts value is JsonObject {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new TypeError(`${path} must be a JSON object`);
  if (Buffer.byteLength(JSON.stringify(value)) > 16384)
    throw new TypeError(`${path} exceeds the safe response limit`);
  for (const [key, child] of Object.entries(value)) {
    if (
      /(?:password|secret|token|signed[_-]?url|source[_-]?content)/i.test(key)
    )
      throw new TypeError(`${path}.${key} is not safe to persist`);
    if (child && typeof child === "object")
      assertSafeResponse(child, `${path}.${key}`);
  }
}

export async function runIdempotentCommand<
  TRequest,
  TResponse extends JsonObject,
>(
  pool: Pool,
  context: Required<ActorContext>,
  operation: string,
  idempotencyKey: string,
  request: TRequest,
  execute: (client: PoolClient) => Promise<TResponse>,
): Promise<IdempotentCommandResult<TResponse>> {
  const requestHash = canonicalRequestHash(request);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL ROLE cumulore_web");
    await client.query("SELECT set_config('app.user_id', $1, true)", [
      context.userId,
    ]);
    await client.query("SELECT set_config('app.workspace_id', $1, true)", [
      context.workspaceId,
    ]);
    await client.query(
      `DELETE FROM endpoint_idempotency_records
       WHERE workspace_id = $1 AND actor_user_id = $2 AND operation = $3
         AND idempotency_key = $4 AND status = 'completed' AND expires_at <= clock_timestamp()`,
      [context.workspaceId, context.userId, operation, idempotencyKey],
    );
    const inserted = await client.query(
      `INSERT INTO endpoint_idempotency_records
         (workspace_id, actor_user_id, operation, idempotency_key, request_hash, expires_at)
       VALUES ($1, $2, $3, $4, $5, clock_timestamp() + interval '24 hours')
       ON CONFLICT (workspace_id, actor_user_id, operation, idempotency_key) DO NOTHING
       RETURNING id`,
      [
        context.workspaceId,
        context.userId,
        operation,
        idempotencyKey,
        requestHash,
      ],
    );
    if (inserted.rowCount === 0) {
      const existing = await client.query<{
        request_hash: Buffer;
        status: "processing" | "completed";
        response_body: TResponse | null;
      }>(
        `SELECT request_hash, status, response_body
         FROM endpoint_idempotency_records
         WHERE workspace_id = $1 AND actor_user_id = $2 AND operation = $3 AND idempotency_key = $4`,
        [context.workspaceId, context.userId, operation, idempotencyKey],
      );
      const record = existing.rows[0];
      if (!record || !record.request_hash.equals(requestHash))
        throw new IdempotencyConflictError();
      if (record.status === "processing") {
        await client.query("COMMIT");
        return { kind: "in_progress" };
      }
      await client.query("COMMIT");
      return { kind: "replayed", response: record.response_body! };
    }

    const response = await execute(client);
    assertSafeResponse(response);
    await client.query(
      `UPDATE endpoint_idempotency_records
       SET status = 'completed', response_status = 200, response_body = $2,
           updated_at = clock_timestamp(), expires_at = clock_timestamp() + interval '24 hours'
       WHERE id = $1`,
      [inserted.rows[0]!.id, response],
    );
    await client.query("COMMIT");
    return { kind: "executed", response };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export function requestSyntheticOperation(
  pool: Pool,
  context: Required<ActorContext>,
  idempotencyKey: string,
  input: Omit<
    CreateSyntheticOperationInput,
    "workspaceId" | "requestedByUserId"
  >,
) {
  return runIdempotentCommand(
    pool,
    context,
    "synthetic.request",
    idempotencyKey,
    input,
    async (client) => ({
      ...(await createSyntheticOperationAndEvent(client, {
        ...input,
        workspaceId: context.workspaceId,
        requestedByUserId: context.userId,
      })),
    }),
  );
}

export function requestJobCancellation(
  pool: Pool,
  context: Required<ActorContext>,
  idempotencyKey: string,
  jobId: string,
) {
  return runIdempotentCommand(
    pool,
    context,
    "job.cancel",
    idempotencyKey,
    { jobId },
    async (client) => {
      const result = await client.query<{ request_job_cancellation: boolean }>(
        "SELECT app.request_job_cancellation($1)",
        [jobId],
      );
      return { accepted: result.rows[0]!.request_job_cancellation };
    },
  );
}

export function manualRetryJob(
  pool: Pool,
  context: Required<ActorContext>,
  idempotencyKey: string,
  jobId: string,
  reason: string,
) {
  return runIdempotentCommand(
    pool,
    context,
    "job.manual_retry",
    idempotencyKey,
    { jobId, reason },
    async (client) => {
      const result = await client.query<{ manual_retry_job: boolean }>(
        "SELECT app.manual_retry_job($1, $2)",
        [jobId, reason],
      );
      return { accepted: result.rows[0]!.manual_retry_job };
    },
  );
}
