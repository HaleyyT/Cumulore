import assert from "node:assert/strict";

import { scienceQuest } from "../src/modules/quest/fixture.js";

for (const difficulty of ["easy", "medium", "hard"] as const) {
  const quest = scienceQuest(difficulty);
  assert.equal(quest.concepts.length, 5);
  assert.deepEqual(
    quest.stages.map((stage) => stage.focus),
    ["foundation", "connection", "synthesis"],
  );
  assert.equal(quest.rematch.length, 4);
  for (const stage of quest.stages) {
    assert.equal(stage.questions.length, 4);
    for (const question of stage.questions) {
      assert.equal(question.options.length, 4);
      assert.ok(
        question.options.some((option) => option.id === question.correctId),
      );
      assert.ok(question.excerpt.length > 0);
    }
  }
}

console.log("Deterministic quest fixture passed.");
