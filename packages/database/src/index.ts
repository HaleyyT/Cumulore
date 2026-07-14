import { Pool, type PoolClient } from "pg";

export {
  createUploadSession,
  finalizeUpload,
  MAX_UPLOAD_BYTES,
  validateUploadSessionInput,
  type CreateUploadSessionInput,
  type SourceFormat,
  type UploadSession,
} from "./ingestion.js";

export {
  appendOutboxEvent,
  createSyntheticOperationAndEvent,
  syntheticOperationScenarios,
  type CreatedSyntheticOperation,
  type CreateSyntheticOperationInput,
  type SyntheticOperationScenario,
} from "./durable-processing.js";
export {
  canonicalRequestHash,
  IdempotencyConflictError,
  manualRetryJob,
  requestJobCancellation,
  requestSyntheticOperation,
  runIdempotentCommand,
  type IdempotentCommandResult,
} from "./idempotency.js";
export { ApplicationError, type ApplicationErrorCode } from "./errors.js";
export {
  createOperationalLogRecord,
  emitOperationalLog,
  type OperationalLog,
  type OperationalLogRecord,
} from "./observability.js";

export type WorkspaceRole = "owner" | "member";

export type ActorContext = {
  userId: string;
  workspaceId?: string;
};

export type ExternalIdentity = {
  issuer: string;
  subject: string;
  email?: string;
};

export type Workspace = { id: string; name: string };

export function createPool(connectionString: string): Pool {
  return new Pool({
    connectionString,
    max: 10,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
    application_name: "cumulore",
  });
}

export async function withActorTransaction<T>(
  pool: Pool,
  context: ActorContext,
  action: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL ROLE cumulore_web");
    await client.query("SELECT set_config('app.user_id', $1, true)", [
      context.userId,
    ]);
    await client.query("SELECT set_config('app.workspace_id', $1, true)", [
      context.workspaceId ?? "",
    ]);
    const result = await action(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function provisionIdentity(
  pool: Pool,
  identity: ExternalIdentity,
): Promise<string> {
  const result = await withProvisioningRole(pool, (client) =>
    client.query<{ user_id: string }>(
      "SELECT app.provision_identity($1, $2, $3) AS user_id",
      [identity.issuer, identity.subject, identity.email ?? null],
    ),
  );
  return result.rows[0]!.user_id;
}

async function withProvisioningRole<T>(
  pool: Pool,
  action: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL ROLE cumulore_web");
    const result = await action(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function createWorkspace(
  pool: Pool,
  userId: string,
  name: string,
): Promise<string> {
  return withActorTransaction(pool, { userId }, async (client) => {
    const result = await client.query<{ workspace_id: string }>(
      "SELECT app.create_workspace($1) AS workspace_id",
      [name],
    );
    return result.rows[0]!.workspace_id;
  });
}

export async function addWorkspaceMember(
  pool: Pool,
  context: ActorContext,
  memberUserId: string,
  role: WorkspaceRole,
): Promise<void> {
  if (!context.workspaceId) throw new Error("Workspace context is required");
  await withActorTransaction(pool, context, async (client) => {
    await client.query("SELECT app.add_workspace_member($1, $2, $3)", [
      context.workspaceId,
      memberUserId,
      role,
    ]);
  });
}

export async function createFolder(
  pool: Pool,
  context: Required<ActorContext>,
  name: string,
  parentId?: string,
): Promise<string> {
  return withActorTransaction(pool, context, async (client) => {
    const folder = await client.query<{ id: string }>(
      "INSERT INTO folders (workspace_id, name, parent_id) VALUES ($1, $2, $3) RETURNING id",
      [context.workspaceId, name, parentId ?? null],
    );
    const folderId = folder.rows[0]!.id;
    await client.query(
      "INSERT INTO folder_closure (workspace_id, ancestor_id, descendant_id, depth) VALUES ($1, $2, $2, 0)",
      [context.workspaceId, folderId],
    );
    if (parentId) {
      const ancestors = await client.query<{
        ancestor_id: string;
        depth: number;
      }>(
        "SELECT ancestor_id, depth FROM folder_closure WHERE workspace_id = $1 AND descendant_id = $2",
        [context.workspaceId, parentId],
      );
      if (ancestors.rows.length === 0)
        throw new Error("Parent folder is not in the workspace");
      for (const ancestor of ancestors.rows) {
        await client.query(
          "INSERT INTO folder_closure (workspace_id, ancestor_id, descendant_id, depth) VALUES ($1, $2, $3, $4)",
          [
            context.workspaceId,
            ancestor.ancestor_id,
            folderId,
            ancestor.depth + 1,
          ],
        );
      }
    }
    return folderId;
  });
}

export async function getWorkspace(
  pool: Pool,
  context: Required<ActorContext>,
): Promise<Workspace | null> {
  return withActorTransaction(pool, context, async (client) => {
    const result = await client.query<Workspace>(
      "SELECT id, name FROM workspaces WHERE id = $1 AND id = $2",
      [context.workspaceId, context.workspaceId],
    );
    return result.rows[0] ?? null;
  });
}
