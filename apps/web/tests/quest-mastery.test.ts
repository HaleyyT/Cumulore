import assert from "node:assert/strict";
import { scienceQuest } from "../src/modules/quest/fixture.js";
import {
  calculateMastery,
  orderRematch,
} from "../src/modules/quest/mastery.js";

const quest = scienceQuest("medium");
const [first, second] = quest.stages[0]!.questions;
const mastery = calculateMastery(quest, {
  [first!.id]: false,
  [second!.id]: true,
});
assert.deepEqual(
  mastery.find((item) => item.conceptId === first!.conceptIds[0]),
  {
    conceptId: "concept-retrieval",
    correct: 0,
    answered: 1,
    wrong: 1,
    mastery: 0,
  },
);
assert.equal(
  orderRematch(quest, mastery)[0]!.conceptIds[0],
  "concept-retrieval",
);
console.log("Quest mastery and rematch ordering passed.");
