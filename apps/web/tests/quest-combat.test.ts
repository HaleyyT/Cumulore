import assert from "node:assert/strict";

import { scienceQuest } from "../src/modules/quest/fixture.js";
import {
  answer,
  initialBattle,
  next,
  QUEST_COMBAT,
} from "../src/modules/quest/reducer.js";

const quest = scienceQuest("medium");
const stage = quest.stages[0]!;

for (let pattern = 0; pattern < 16; pattern += 1) {
  let battle = initialBattle();
  let expectedHearts = QUEST_COMBAT.startingHearts;
  let expectedScore = 0;

  for (
    let index = 0;
    index < stage.questions.length && !battle.stageFailed && battle.health > 0;
    index += 1
  ) {
    const question = stage.questions[index]!;
    const correct = (pattern & (1 << index)) !== 0;
    const chosen = correct ? question.correctId : question.options[1]!.id;
    const afterAnswer = answer(quest, battle, chosen);
    assert.deepEqual(
      answer(quest, afterAnswer, chosen),
      afterAnswer,
      `pattern ${pattern} resists duplicate submission`,
    );
    if (correct) expectedScore += 100;
    else expectedHearts -= 1;
    battle = next(quest, afterAnswer);
  }

  assert.equal(
    battle.hearts,
    expectedHearts,
    `pattern ${pattern} has expected hearts`,
  );
  assert.ok(
    battle.score >= expectedScore,
    `pattern ${pattern} preserves correct-answer score`,
  );
  assert.ok(
    battle.health >= 0 && battle.health <= 100,
    `pattern ${pattern} bounds health`,
  );
}

let winningBattle = initialBattle();
for (const question of stage.questions.slice(0, 3)) {
  winningBattle = next(quest, answer(quest, winningBattle, question.correctId));
}
assert.equal(
  winningBattle.health,
  0,
  "three consecutive correct answers defeat the enemy",
);
assert.equal(winningBattle.score, 375, "streak bonuses are deterministic");

console.log("Quest combat patterns passed.");
