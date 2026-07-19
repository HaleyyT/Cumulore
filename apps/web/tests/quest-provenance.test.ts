import assert from "node:assert/strict";
import validQuest from "../../../packages/schemas/fixtures/quest-generation.v1.valid.json" with { type: "json" };
import { segmentSource } from "../src/modules/quest/source-segmentation.js";
import { validateQuestSemantics } from "../src/modules/quest/validation.js";

const source = segmentSource(
  "Retrieval practice strengthens learning. Spacing distributes practice. Interleaving mixes problem types. Feedback corrects errors. Transfer applies learning.",
);
function expectFailure(value: unknown, expectedCode: string): void {
  const result = validateQuestSemantics(
    value as typeof validQuest,
    source,
    "medium",
    "Science of Learning",
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, expectedCode);
}

assert.equal(
  validateQuestSemantics(validQuest, source, "medium", "Science of Learning")
    .ok,
  true,
);
const wrongTitle = structuredClone(validQuest);
wrongTitle.sourceTitle = "Different source";
expectFailure(wrongTitle, "SCHEMA_INVALID");
const missingLocator = structuredClone(validQuest);
missingLocator.stages[0]!.questions[0]!.evidence[0]!.segmentId = "S999";
expectFailure(missingLocator, "EXCERPT_MISMATCH");
const wrongOperation = structuredClone(validQuest);
wrongOperation.stages[0]!.questions[0]!.cognitiveOperation = "transfer";
expectFailure(wrongOperation, "DIFFICULTY_RULE_MISMATCH");
const duplicatePrompt = structuredClone(validQuest);
duplicatePrompt.rematchQuestions[0]!.prompt =
  duplicatePrompt.stages[0]!.questions[0]!.prompt;
expectFailure(duplicatePrompt, "CONTENT_DUPLICATE");
console.log("Quest provenance and difficulty validation passed.");
