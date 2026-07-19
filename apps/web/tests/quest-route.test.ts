import assert from "node:assert/strict";

import { createQuestPostHandler } from "../src/app/api/quest/generate/route.js";
import type { QuestRuntimeConfig } from "../src/modules/quest/runtime-config.js";

const requestId = "3fa85f64-5717-4562-b3fc-2c963f66afa6";
const baseConfig: QuestRuntimeConfig = {
  provider: "openai",
  liveEnabled: true,
  apiKey: "test-only-key",
  model: "gpt-5.6-sol",
  timeoutMs: 45000,
  sourceMaxChars: 20000,
};

function request(sourceText = "x".repeat(500), learningGoal?: string) {
  const data = new FormData();
  data.set("requestId", requestId);
  data.set("sourceTitle", "Source");
  data.set("sourceText", sourceText);
  data.set("requestedDifficulty", "medium");
  data.set("mode", "live");
  data.set("consent", "true");
  if (learningGoal) data.set("learningGoal", learningGoal);
  return new Request("http://localhost/api/quest/generate", {
    method: "POST",
    body: data,
  });
}

let calls = 0;
const disabled = createQuestPostHandler({
  readConfig: () => ({ ...baseConfig, liveEnabled: false, apiKey: undefined }),
  generate: async () => {
    calls += 1;
    return { ok: true, quest: {} };
  },
});
const disabledResponse = await disabled(request());
assert.equal(disabledResponse.status, 503);
assert.deepEqual(await disabledResponse.json(), {
  requestId,
  error: {
    code: "LIVE_MODE_DISABLED",
    message: "Live AI is unavailable. Use Deterministic Demo.",
  },
});
assert.equal(calls, 0, "disabled live mode must not reach the provider");

const invalid = await disabled(
  new Request("http://localhost/api/quest/generate", {
    method: "POST",
    body: new FormData(),
  }),
);
assert.equal(invalid.status, 400);
assert.equal((await invalid.json()).error.code, "INVALID_REQUEST");

const sourceTooLarge = createQuestPostHandler({
  readConfig: () => ({ ...baseConfig, sourceMaxChars: 500 }),
  generate: async () => {
    throw new Error("must not run");
  },
});
assert.equal((await sourceTooLarge(request("x".repeat(501)))).status, 413);

const invalidGeneration = createQuestPostHandler({
  readConfig: () => baseConfig,
  generate: async () => ({ ok: false, code: "GENERATION_INVALID" }),
});
assert.equal((await invalidGeneration(request())).status, 422);

let receivedLearningGoal: string | undefined;
const success = createQuestPostHandler({
  readConfig: () => baseConfig,
  generate: async (_, input) => {
    receivedLearningGoal = input.learningGoal;
    return { ok: true, quest: { title: "Safe result" } };
  },
});
const successResponse = await success(
  request(undefined, "Distinguish related definitions."),
);
assert.equal(successResponse.status, 200);
assert.deepEqual(await successResponse.json(), {
  requestId,
  mode: "live",
  quest: { title: "Safe result" },
});
assert.equal(receivedLearningGoal, "Distinguish related definitions.");

const rateLimited = createQuestPostHandler({
  readConfig: () => baseConfig,
  generate: async () => {
    throw { status: 429, sourceText: "must not be exposed" };
  },
});
const rateResponse = await rateLimited(request());
assert.equal(rateResponse.status, 429);
assert.equal((await rateResponse.json()).error.code, "RATE_LIMITED");

console.log("Quest route safety boundary passed.");
