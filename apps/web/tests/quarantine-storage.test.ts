import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { LocalQuarantineStorage } from "../src/modules/ingestion/quarantine-storage.js";

const root = await mkdtemp(join(tmpdir(), "cumulore-quarantine-"));
try {
  const storage = new LocalQuarantineStorage(root);
  const object = await storage.put(
    "quarantine/workspace/object",
    Buffer.from("safe"),
  );
  assert.equal(object.byteSize, 4);
  assert.deepEqual(await storage.head(object.key), { byteSize: 4 });
  assert.deepEqual(await storage.read(object.key), Buffer.from("safe"));
  await assert.rejects(() =>
    storage.put("quarantine/../escape", Buffer.from("bad")),
  );
  console.log("Quarantine storage tests passed.");
} finally {
  await rm(root, { recursive: true, force: true });
}
