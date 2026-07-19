import assert from "node:assert/strict";
import validQuestFixture from "../../../packages/schemas/fixtures/quest-generation.v1.valid.json" with { type: "json" };
import { parseQuestGenerationV1 } from "@cumulore/schemas/quest-generation";
import { segmentSource } from "../src/modules/quest/source-segmentation.js";
import { validateQuestSemantics } from "../src/modules/quest/validation.js";

const validQuest = parseQuestGenerationV1(validQuestFixture);

const source = segmentSource(
  "Retrieval practice strengthens learning. Spacing distributes practice. Interleaving mixes problem types. Feedback corrects errors. Transfer applies learning.",
);
const narrowSegments = segmentSource("alpha beta gamma delta epsilon", 10);
assert.deepEqual(
  narrowSegments.map(({ id }) => id),
  narrowSegments.map((_, index) => `S${String(index + 1).padStart(3, "0")}`),
);
assert.equal(
  narrowSegments.every(({ text }) => text.length <= 10),
  true,
);
assert.throws(() => segmentSource("content", 0), /positive integer/);
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
expectFailure(missingLocator, "LOCATOR_UNKNOWN");
const wrongOperation = structuredClone(validQuest);
wrongOperation.stages[0]!.questions[0]!.cognitiveOperation = "transfer";
expectFailure(wrongOperation, "DIFFICULTY_RULE_MISMATCH");
const wrongStageOrder = structuredClone(validQuest);
wrongStageOrder.stages[0]!.cognitiveFocus = "connection";
expectFailure(wrongStageOrder, "DIFFICULTY_RULE_MISMATCH");
const unsupportedRematchOperation = structuredClone(validQuest);
unsupportedRematchOperation.rematchQuestions[0]!.cognitiveOperation =
  "recognize";
expectFailure(unsupportedRematchOperation, "DIFFICULTY_RULE_MISMATCH");
const conceptEvidenceMismatch = structuredClone(validQuest);
conceptEvidenceMismatch.priorityConcepts[0]!.evidence[0]!.excerpt =
  "This excerpt was not supplied.";
expectFailure(conceptEvidenceMismatch, "EXCERPT_MISMATCH");
const unknownConcept = structuredClone(validQuest);
unknownConcept.stages[0]!.questions[0]!.conceptIds = ["concept-unknown"];
expectFailure(unknownConcept, "REFERENCE_INVALID");
const duplicateGlobalIdentifier = structuredClone(validQuest);
duplicateGlobalIdentifier.stages[0]!.questions[1]!.options[1]!.optionId =
  duplicateGlobalIdentifier.stages[0]!.questions[0]!.options[0]!.optionId;
expectFailure(duplicateGlobalIdentifier, "IDENTIFIER_DUPLICATE");
const duplicatePrompt = structuredClone(validQuest);
duplicatePrompt.rematchQuestions[0]!.prompt =
  duplicatePrompt.stages[0]!.questions[0]!.prompt;
expectFailure(duplicatePrompt, "CONTENT_DUPLICATE");
console.log("Quest provenance and difficulty validation passed.");
