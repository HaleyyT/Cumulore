import assert from "node:assert/strict";
import { readQuestRuntimeConfig } from "../src/modules/quest/runtime-config.js";

assert.deepEqual(readQuestRuntimeConfig({}), {
  provider: "fixture",
  liveEnabled: false,
  apiKey: undefined,
  model: "gpt-5.6-terra",
  reasoningEffort: "low",
  timeoutMs: 45000,
  sourceMaxChars: 10000,
  maxOutputTokens: 10000,
});
assert.throws(
  () => readQuestRuntimeConfig({ QUEST_PROVIDER: "OPENAI" }),
  /Invalid quest provider/,
);
assert.throws(
  () => readQuestRuntimeConfig({ QUEST_LIVE_GENERATION_ENABLED: "1" }),
  /Invalid live generation/,
);
assert.throws(
  () => readQuestRuntimeConfig({ QUEST_LIVE_GENERATION_ENABLED: "true" }),
  /QUEST_PROVIDER=openai/,
);
assert.throws(
  () =>
    readQuestRuntimeConfig({
      QUEST_PROVIDER: "openai",
      QUEST_LIVE_GENERATION_ENABLED: "true",
    }),
  /OPENAI_API_KEY/,
);
assert.throws(
  () =>
    readQuestRuntimeConfig({
      QUEST_PROVIDER: "openai",
      QUEST_LIVE_GENERATION_ENABLED: "true",
      OPENAI_API_KEY: "your_actual_OpenAI_API_key",
    }),
  /non-placeholder OPENAI_API_KEY/,
);
assert.equal(
  readQuestRuntimeConfig({
    QUEST_PROVIDER: "openai",
    QUEST_LIVE_GENERATION_ENABLED: "true",
    OPENAI_API_KEY: `sk-test-${"x".repeat(32)}`,
    OPENAI_QUEST_REASONING_EFFORT: "medium",
  }).reasoningEffort,
  "medium",
);
assert.throws(
  () => readQuestRuntimeConfig({ OPENAI_QUEST_TIMEOUT_MS: "1" }),
  /Invalid quest timeout/,
);
assert.throws(
  () => readQuestRuntimeConfig({ QUEST_SOURCE_MAX_CHARS: "10001" }),
  /Invalid quest source limit/,
);
assert.throws(
  () => readQuestRuntimeConfig({ QUEST_OUTPUT_MAX_TOKENS: "3999" }),
  /Invalid quest output limit/,
);
assert.throws(
  () => readQuestRuntimeConfig({ QUEST_OUTPUT_MAX_TOKENS: "10001" }),
  /Invalid quest output limit/,
);
assert.throws(
  () => readQuestRuntimeConfig({ OPENAI_QUEST_REASONING_EFFORT: "max" }),
  /Invalid quest reasoning/,
);
assert.throws(
  () => readQuestRuntimeConfig({ OPENAI_QUEST_MODEL: "unapproved-model" }),
  /Invalid quest model/,
);
console.log("Quest runtime configuration passed.");
