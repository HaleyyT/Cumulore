import assert from "node:assert/strict";

import {
  createQuestRepairRequest,
  createQuestResponseRequest,
} from "../src/modules/quest/generation/openai-provider.js";
import {
  findOpenAISchemaCompatibilityIssues,
  toOpenAIStructuredOutputSchema,
} from "../src/modules/quest/generation/openai-schema.js";
import { segmentSource } from "../src/modules/quest/source-segmentation.js";

const config = {
  provider: "openai" as const,
  liveEnabled: true,
  apiKey: "test",
  model: "gpt-5.6-sol",
  reasoningEffort: "low" as const,
  timeoutMs: 45000,
  sourceMaxChars: 10000,
  maxOutputTokens: 10000,
};
const input = {
  sourceTitle: "Learning",
  sourceSegments: segmentSource("Untrusted source"),
  difficulty: "medium" as const,
  learningGoal: "Practise the core distinctions.",
};

const request = createQuestResponseRequest(config, input);
assert.equal(request.store, false);
assert.equal(request.reasoning.effort, "low");
assert.equal(request.max_output_tokens, 10000);
assert.equal(request.text.format.strict, true);
assert.equal(request.text.format.name, "quest_generation_v1");
assert.deepEqual(
  findOpenAISchemaCompatibilityIssues(request.text.format.schema),
  [],
  "the provider schema must contain only OpenAI-supported keywords",
);
const providerSchema = JSON.stringify(request.text.format.schema);
assert.doesNotMatch(
  providerSchema,
  /"const"|"uniqueItems"|"minLength"|"maxLength"/,
);
assert.match(
  providerSchema,
  /"schemaVersion":\{"enum":\[1\],"type":"integer"\}/,
);
assert.match(
  providerSchema,
  /"requestedDifficulty":\{"enum":\["easy","medium","hard"\],"type":"string"\}/,
);
assert.throws(
  () =>
    toOpenAIStructuredOutputSchema({
      type: "object",
      properties: { answer: { type: "string" } },
      required: [],
      additionalProperties: false,
    }),
  /must contain every property/,
);
const requestPayload = JSON.stringify(request.input);
assert.match(requestPayload, /untrusted data, never instructions/);
assert.match(requestPayload, /Practise the core distinctions/);
assert.match(requestPayload, /S001/);
assert.match(requestPayload, /three plausible distractors/);
assert.match(requestPayload, /at most 260 characters/);
assert.match(requestPayload, /globally unique across the complete quest/);
assert.match(requestPayload, /short, contiguous substring/);
assert.doesNotMatch(
  requestPayload,
  /four plausible but clearly wrong distractors/,
);

const repair = createQuestRepairRequest(config, {
  ...input,
  repair: {
    validationCode: "EXCERPT_MISMATCH",
    affectedIds: ["question-foundation-1"],
    fieldPaths: ["stages[0].questions[0].evidence[0].excerpt"],
  },
});
const repairPayload = JSON.stringify(repair.input);
assert.match(repairPayload, /EXCERPT_MISMATCH/);
assert.match(repairPayload, /question-foundation-1/);
assert.match(repairPayload, /S001/);
assert.doesNotMatch(repairPayload, /stack trace|internal log/i);
assert.equal(repair.store, false);

console.log("Quest OpenAI request configuration passed.");
