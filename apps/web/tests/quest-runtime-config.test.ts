import assert from "node:assert/strict";
import { readQuestRuntimeConfig } from "../src/modules/quest/runtime-config.js";

assert.deepEqual(readQuestRuntimeConfig({}), {
  provider: "fixture",
  liveEnabled: false,
  apiKey: undefined,
  model: "gpt-5.6-sol",
  timeoutMs: 45000,
  sourceMaxChars: 20000,
});
assert.throws(
  () => readQuestRuntimeConfig({ QUEST_LIVE_GENERATION_ENABLED: "true" }),
  /OPENAI_API_KEY/,
);
assert.throws(
  () => readQuestRuntimeConfig({ OPENAI_QUEST_TIMEOUT_MS: "1" }),
  /Invalid quest timeout/,
);
assert.throws(
  () => readQuestRuntimeConfig({ QUEST_SOURCE_MAX_CHARS: "20001" }),
  /Invalid quest source limit/,
);
console.log("Quest runtime configuration passed.");
