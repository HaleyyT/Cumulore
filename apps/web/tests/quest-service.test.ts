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
      sourceTitle: "Science",
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
    }).generate({ sourceTitle: "Science", sourceText, difficulty: "medium" })
  ).ok,
  false,
);
console.log("Quest service validation boundary passed.");
