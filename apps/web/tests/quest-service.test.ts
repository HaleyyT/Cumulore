import assert from "node:assert/strict";
import validQuest from "../../../packages/schemas/fixtures/quest-generation.v1.valid.json" with { type: "json" };
import { QuestService } from "../src/modules/quest/generation/quest-service.js";

const sourceText =
  "Retrieval practice strengthens learning. Spacing distributes practice. Interleaving mixes problem types. Feedback corrects errors. Transfer applies learning.";
const service = new QuestService({
  async generate() {
    return validQuest;
  },
});
assert.equal(
  (
    await service.generate({
      sourceTitle: "Science of Learning",
      sourceText,
      difficulty: "medium",
    })
  ).ok,
  true,
);
const invalid = structuredClone(validQuest);
invalid.stages[0]!.questions[0]!.evidence[0]!.excerpt = "not in source";
assert.equal(
  (
    await new QuestService({
      async generate() {
        return invalid;
      },
    }).generate({
      sourceTitle: "Science of Learning",
      sourceText,
      difficulty: "medium",
    })
  ).ok,
  false,
);
let repairs = 0;
assert.equal(
  (
    await new QuestService({
      async generate() {
        return invalid;
      },
      async repair(input) {
        repairs += 1;
        assert.equal(input.validationCode, "EXCERPT_MISMATCH");
        return validQuest;
      },
    }).generate({
      sourceTitle: "Science of Learning",
      sourceText,
      difficulty: "medium",
    })
  ).ok,
  true,
);
assert.equal(repairs, 1, "one sanitized repair is permitted");
let failedRepairs = 0;
assert.equal(
  (
    await new QuestService({
      async generate() {
        return invalid;
      },
      async repair(input) {
        failedRepairs += 1;
        assert.deepEqual(Object.keys(input).sort(), [
          "difficulty",
          "sourceText",
          "sourceTitle",
          "validationCode",
        ]);
        return invalid;
      },
    }).generate({ sourceTitle: "Science", sourceText, difficulty: "medium" })
  ).ok,
  false,
);
assert.equal(failedRepairs, 1, "an invalid repair is not retried");
console.log("Quest service validation boundary passed.");
