import assert from "node:assert/strict";

import {
  createFolder,
  createPool,
  createWorkspace,
  getWorkspace,
  provisionIdentity,
  addWorkspaceMember,
} from "../src/index.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString)
  throw new Error("DATABASE_URL is required for integration tests");
const pool = createPool(connectionString);

async function reset(): Promise<void> {
  await pool.query("SET ROLE cumulore_migration");
  await pool.query(
    "TRUNCATE folder_closure, folders, workspace_members, workspaces, external_identities, users CASCADE",
  );
  await pool.query("RESET ROLE");
}

try {
  await reset();
  const userA = await provisionIdentity(pool, {
    issuer: "https://fake.identity.local/",
    subject: "a",
    email: "old@example.test",
  });
  const sameUserA = await provisionIdentity(pool, {
    issuer: "https://fake.identity.local/",
    subject: "a",
    email: "new@example.test",
  });
  const userB = await provisionIdentity(pool, {
    issuer: "https://fake.identity.local/",
    subject: "b",
  });
  assert.equal(userA, sameUserA, "issuer and subject provision idempotently");
  const email = await pool.query<{ email: string }>(
    "SELECT email FROM external_identities WHERE user_id = $1",
    [userA],
  );
  assert.equal(
    email.rows[0]!.email,
    "new@example.test",
    "email remains mutable profile data",
  );

  const workspaceA = await createWorkspace(pool, userA, "Workspace A");
  const workspaceB = await createWorkspace(pool, userB, "Workspace B");
  await addWorkspaceMember(
    pool,
    { userId: userA, workspaceId: workspaceA },
    userB,
    "member",
  );
  assert.deepEqual(
    await getWorkspace(pool, { userId: userA, workspaceId: workspaceA }),
    { id: workspaceA, name: "Workspace A" },
  );
  assert.equal(
    await getWorkspace(pool, { userId: userA, workspaceId: workspaceB }),
    null,
    "foreign workspace is hidden",
  );

  const rootFolder = await createFolder(
    pool,
    { userId: userA, workspaceId: workspaceA },
    "Root folder",
  );
  const childFolder = await createFolder(
    pool,
    { userId: userA, workspaceId: workspaceA },
    "Child folder",
    rootFolder,
  );
  const closure = await pool.query<{ depth: number }>(
    "SELECT depth FROM folder_closure WHERE workspace_id = $1 AND ancestor_id = $2 AND descendant_id = $3",
    [workspaceA, rootFolder, childFolder],
  );
  assert.equal(
    closure.rows[0]!.depth,
    1,
    "folder closure records the parent ancestor",
  );
  await assert.rejects(() =>
    createFolder(
      pool,
      { userId: userB, workspaceId: workspaceB },
      "Foreign parent",
      rootFolder,
    ),
  );

  const direct = await pool.connect();
  try {
    await direct.query("BEGIN");
    await direct.query("SET LOCAL ROLE cumulore_web");
    await direct.query("SELECT set_config('app.user_id', $1, true)", [userA]);
    await direct.query("SELECT set_config('app.workspace_id', '', true)");
    const missingContext = await direct.query("SELECT id FROM workspaces");
    assert.equal(
      missingContext.rowCount,
      0,
      "missing workspace context is denied by RLS",
    );
    await direct.query("ROLLBACK");
    await direct.query("BEGIN");
    await direct.query("SET LOCAL ROLE cumulore_worker");
    await assert.rejects(() => direct.query("SELECT id FROM workspaces"));
    await direct.query("ROLLBACK");
  } finally {
    direct.release();
  }

  await pool.query("SET ROLE cumulore_migration");
  await pool.query(
    "UPDATE workspace_members SET active = false WHERE workspace_id = $1 AND user_id = $2",
    [workspaceA, userB],
  );
  await pool.query("RESET ROLE");
  assert.equal(
    await getWorkspace(pool, { userId: userB, workspaceId: workspaceA }),
    null,
    "inactive membership is denied",
  );
  console.log("PostgreSQL tenancy integration tests passed.");
} finally {
  await pool.end();
}
