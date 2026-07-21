import assert from "node:assert/strict";

import { scienceQuest } from "../src/modules/quest/fixture.js";

const promptsByDifficulty = new Map<string, Set<string>>();

for (const difficulty of ["easy", "medium", "hard"] as const) {
  const quest = scienceQuest(difficulty);
  assert.equal(quest.concepts.length, 5);
  assert.deepEqual(
    quest.stages.map((stage) => stage.focus),
    ["foundation", "connection", "synthesis"],
  );
  assert.equal(quest.rematch.length, 4);
  assert.equal(
    new Set(quest.stages.map((stage) => stage.misconception)).size,
    3,
  );
  const prompts = new Set<string>();
  const referencedConcepts = new Set<string>();
  for (const stage of quest.stages) {
    assert.equal(stage.questions.length, 4);
    for (const question of stage.questions) {
      assert.equal(question.options.length, 4);
      assert.ok(
        question.options.some((option) => option.id === question.correctId),
      );
      assert.ok(question.excerpt.length > 0);
      assert.ok(question.explanation.length >= 60);
      assert.equal(prompts.has(question.prompt), false);
      prompts.add(question.prompt);
      question.conceptIds.forEach((conceptId) =>
        referencedConcepts.add(conceptId),
      );
    }
  }
  for (const question of quest.rematch) {
    assert.equal(prompts.has(question.prompt), false);
    prompts.add(question.prompt);
    question.conceptIds.forEach((conceptId) =>
      referencedConcepts.add(conceptId),
    );
  }
  assert.equal(prompts.size, 16);
  assert.deepEqual(
    referencedConcepts,
    new Set(quest.concepts.map((concept) => concept.id)),
  );
  promptsByDifficulty.set(difficulty, prompts);
}

assert.equal(
  [...promptsByDifficulty.get("easy")!].some((prompt) =>
    promptsByDifficulty.get("medium")!.has(prompt),
  ),
  false,
);
assert.equal(
  [...promptsByDifficulty.get("medium")!].some((prompt) =>
    promptsByDifficulty.get("hard")!.has(prompt),
  ),
  false,
);

console.log("Deterministic quest fixture passed.");
