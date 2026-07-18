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
console.log("Quest submission gate passed.");
