import assert from "node:assert/strict";

import { scienceQuest } from "../src/modules/quest/fixture.js";
import { calculateStageProgress } from "../src/modules/quest/progress.js";
import { answer, initialBattle, next } from "../src/modules/quest/reducer.js";

const quest = scienceQuest("medium");
const stage = quest.stages[0]!;
let battle = initialBattle();

assert.equal(calculateStageProgress(stage, battle), 0);
battle = answer(quest, battle, stage.questions[0]!.correctId);
assert.equal(calculateStageProgress(stage, battle), 25);
battle = next(quest, battle);
battle = answer(quest, battle, stage.questions[1]!.correctId);
battle = next(quest, battle);
battle = answer(quest, battle, stage.questions[2]!.correctId);
assert.equal(
  calculateStageProgress(stage, battle),
  100,
  "an early victory completes the stage progress meter",
);

console.log("Quest progress calculation passed.");
