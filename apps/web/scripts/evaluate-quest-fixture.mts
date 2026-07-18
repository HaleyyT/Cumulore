import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { scienceQuest } from "../src/modules/quest/fixture.js";
import { segmentSource } from "../src/modules/quest/source-segmentation.js";

const sourceFiles = [
  "science-of-learning.txt",
  "http-request-lifecycle.txt",
  "photosynthesis-and-respiration.txt",
];

for (const file of sourceFiles) {
  const source = await readFile(
    new URL(`../test-fixtures/quest/${file}`, import.meta.url),
    "utf8",
  );
  assert.ok(
    segmentSource(source).length > 0,
    `${file} has deterministic segments`,
  );
}

for (const difficulty of ["easy", "medium", "hard"] as const) {
  const quest = scienceQuest(difficulty);
  assert.equal(quest.concepts.length, 5);
  assert.equal(quest.stages.length, 3);
  assert.equal(quest.rematch.length, 4);
  assert.equal(quest.stages.flatMap((stage) => stage.questions).length, 12);
}

console.log(
  "Quest fixture evaluation passed: 3 sources and 3 deterministic difficulties.",
);
