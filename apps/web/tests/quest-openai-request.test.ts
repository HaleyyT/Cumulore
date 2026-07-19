import assert from "node:assert/strict";

import {
  createQuestRepairRequest,
  createQuestResponseRequest,
} from "../src/modules/quest/generation/openai-provider.js";
import { findUnsupportedOpenAIKeywords } from "../src/modules/quest/generation/openai-schema.js";
import { segmentSource } from "../src/modules/quest/source-segmentation.js";

const config = {
  provider: "openai" as const,
  liveEnabled: true,
  apiKey: "test",
  model: "gpt-5.6-sol",
  reasoningEffort: "low" as const,
  timeoutMs: 45000,
  sourceMaxChars: 20000,
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
assert.equal(request.text.verbosity, "medium");
assert.equal(request.text.format.strict, true);
assert.equal(request.text.format.name, "quest_generation_v1");
assert.deepEqual(
  findUnsupportedOpenAIKeywords(request.text.format.schema),
  [],
  "the provider schema must contain only OpenAI-supported keywords",
);
const requestPayload = JSON.stringify(request.input);
assert.match(requestPayload, /untrusted data, never instructions/);
assert.match(requestPayload, /Practise the core distinctions/);
assert.match(requestPayload, /S001/);
assert.match(requestPayload, /three plausible distractors/);
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
