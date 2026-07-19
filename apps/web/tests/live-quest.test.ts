import assert from "node:assert/strict";
import validQuest from "../../../packages/schemas/fixtures/quest-generation.v1.valid.json" with { type: "json" };

import { toRuntimeQuest } from "../src/modules/quest/live-quest.js";

const runtime = toRuntimeQuest(validQuest);
assert.ok(runtime);
assert.equal(runtime.title, "Science of Learning");
assert.equal(runtime.difficulty, "medium");
assert.equal(runtime.concepts.length, 5);
assert.equal(runtime.stages.length, 3);
assert.equal(runtime.rematch.length, 4);
assert.equal(runtime.takeaways.length, 3);
assert.equal(
  runtime.takeaways[0]?.text,
  "Retrieve ideas to strengthen recall.",
);
assert.equal(
  runtime.stages[0]?.questions[0]?.explanation,
  "Retrieval supports recall.",
);
assert.equal(
  "health" in runtime,
  false,
  "provider content cannot set combat state",
);

const missingEvidence = structuredClone(validQuest);
missingEvidence.stages[0]!.questions[0]!.evidence = [];
assert.equal(toRuntimeQuest(missingEvidence), undefined);

const invalidOption = structuredClone(validQuest);
invalidOption.stages[0]!.questions[0]!.options = [];
assert.equal(toRuntimeQuest(invalidOption), undefined);

console.log("Live quest runtime adaptation passed.");
