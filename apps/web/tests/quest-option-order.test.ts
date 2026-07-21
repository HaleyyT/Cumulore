import assert from "node:assert/strict";

import { scienceQuest } from "../src/modules/quest/fixture.js";
import { orderQuestionOptions } from "../src/modules/quest/option-order.js";

const question = scienceQuest("medium").stages[0]!.questions[0]!;
const sourceOrder = question.options.map((option) => option.id);
const firstRun = orderQuestionOptions(question, 71);

assert.deepEqual(
  firstRun.map((option) => option.id).sort(),
  [...sourceOrder].sort(),
  "shuffling preserves every option",
);
assert.deepEqual(
  orderQuestionOptions(question, 71),
  firstRun,
  "one run has a stable option order",
);
assert.deepEqual(
  question.options.map((option) => option.id),
  sourceOrder,
  "presentation ordering never mutates source-grounded quest content",
);

for (const questionInRun of scienceQuest("medium").stages[0]!.questions) {
  const correctPositions = new Set(
    Array.from({ length: 256 }, (_, seed) =>
      orderQuestionOptions(questionInRun, seed).findIndex(
        (option) => option.id === questionInRun.correctId,
      ),
    ),
  );
  assert.deepEqual(
    [...correctPositions].sort(),
    [0, 1, 2, 3],
    `${questionInRun.id} can place its correct answer in A, B, C, or D`,
  );
}

console.log("Quest option ordering passed.");
