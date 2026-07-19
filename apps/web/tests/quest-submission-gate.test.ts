import assert from "node:assert/strict";
import { QuestSubmissionGate } from "../src/modules/quest/generation/submission-gate.js";

const gate = new QuestSubmissionGate<string>();
let calls = 0;
let resolve!: (value: string) => void;
const create = () => {
  calls += 1;
  return new Promise<string>((done) => {
    resolve = done;
  });
};
const first = gate.submit(create);
const duplicate = gate.submit(create);
assert.equal(first, duplicate);
assert.equal(calls, 1);
resolve("quest");
assert.equal(await first, "quest");
await assert.rejects(() => gate.submit(create), /REQUEST_ALREADY_COMPLETED/);

const recoverable = new QuestSubmissionGate<{ ok: boolean }>();
let recoverableCalls = 0;
assert.deepEqual(
  await recoverable.submit(
    async () => {
      recoverableCalls += 1;
      return { ok: false };
    },
    (result) => result.ok,
  ),
  { ok: false },
);
assert.deepEqual(
  await recoverable.submit(
    async () => {
      recoverableCalls += 1;
      return { ok: true };
    },
    (result) => result.ok,
  ),
  { ok: true },
);
assert.equal(recoverableCalls, 2, "failed requests remain recoverable");
await assert.rejects(
  () => recoverable.submit(async () => ({ ok: true })),
  /REQUEST_ALREADY_COMPLETED/,
);
console.log("Quest submission gate passed.");
