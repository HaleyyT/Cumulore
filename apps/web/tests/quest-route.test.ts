import assert from "node:assert/strict";
import validQuestFixture from "../../../packages/schemas/fixtures/quest-generation.v1.valid.json" with { type: "json" };
import { parseQuestGenerationV1 } from "@cumulore/schemas/quest-generation";

import {
  createQuestPostHandler,
  maxDuration,
} from "../src/app/api/quest/generate/route.js";
import type { QuestRuntimeConfig } from "../src/modules/quest/runtime-config.js";

const requestId = "3fa85f64-5717-4562-b3fc-2c963f66afa6";
const validQuest = parseQuestGenerationV1(validQuestFixture);
assert.equal(
  maxDuration,
  120,
  "the route deadline must cover an initial provider call and one repair",
);
const baseConfig: QuestRuntimeConfig = {
  provider: "openai",
  liveEnabled: true,
  apiKey: "test-only-key",
  model: "gpt-5.6-sol",
  reasoningEffort: "low",
  timeoutMs: 45000,
  sourceMaxChars: 10000,
  maxOutputTokens: 10000,
};

function request(sourceText = "x".repeat(100), learningGoal?: string) {
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
    return { ok: true, quest: validQuest };
  },
});
const disabledResponse = await disabled(request());
assert.equal(disabledResponse.status, 503);
assert.deepEqual(await disabledResponse.json(), {
  requestId,
  error: {
    code: "LIVE_MODE_DISABLED",
    message:
      "Live AI is not enabled for this deployment. The ready-made quest is still available.",
  },
});
assert.equal(calls, 0, "disabled live mode must not reach the provider");

const fixtureProvider = createQuestPostHandler({
  readConfig: () => ({ ...baseConfig, provider: "fixture" }),
  generate: async () => {
    throw new Error("fixture provider must not receive a live request");
  },
});
assert.equal((await fixtureProvider(request())).status, 503);

const invalid = await disabled(
  new Request("http://localhost/api/quest/generate", {
    method: "POST",
    body: new FormData(),
  }),
);
assert.equal(invalid.status, 400);
assert.equal((await invalid.json()).error.code, "INVALID_REQUEST");

const sourceTooLarge = createQuestPostHandler({
  readConfig: () => ({ ...baseConfig, sourceMaxChars: 100 }),
  generate: async () => {
    throw new Error("must not run");
  },
});
assert.equal((await sourceTooLarge(request("x".repeat(101)))).status, 413);

const sourceTooShort = createQuestPostHandler({
  readConfig: () => baseConfig,
  generate: async () => {
    throw new Error("must not run");
  },
});
assert.equal((await sourceTooShort(request("x".repeat(99)))).status, 400);
assert.equal(
  (await sourceTooShort(request(" ".repeat(100)))).status,
  400,
  "whitespace cannot satisfy the minimum source length",
);

const validationLogs: Array<Record<string, unknown>> = [];
const invalidGeneration = createQuestPostHandler({
  readConfig: () => baseConfig,
  generate: async () => ({
    ok: false,
    code: "GENERATION_INVALID",
    diagnostics: {
      initial: {
        validationCode: "IDENTIFIER_DUPLICATE",
        fieldPaths: ["stages[0].questions[1].options[0].optionId"],
      },
      final: {
        validationCode: "EXCERPT_MISMATCH",
        fieldPaths: ["rematchQuestions[2].evidence[0].excerpt"],
      },
    },
  }),
  logFailure: (entry) => validationLogs.push(entry),
});
assert.equal((await invalidGeneration(request())).status, 422);
assert.deepEqual(validationLogs, [
  {
    requestId,
    code: "GENERATION_INVALID",
    durationMs: validationLogs[0]?.durationMs,
    validationPhase: "repair",
    validationCode: "EXCERPT_MISMATCH",
    fieldPaths: ["rematchQuestions[2].evidence[0].excerpt"],
  },
]);

let receivedLearningGoal: string | undefined;
const success = createQuestPostHandler({
  readConfig: () => baseConfig,
  generate: async (_, input) => {
    receivedLearningGoal = input.learningGoal;
    return { ok: true, quest: validQuest };
  },
});
const successResponse = await success(
  request(undefined, "Distinguish related definitions."),
);
assert.equal(successResponse.status, 200);
assert.deepEqual(await successResponse.json(), {
  requestId,
  mode: "live",
  quest: validQuest,
});
assert.equal(receivedLearningGoal, "Distinguish related definitions.");

const rateLimited = createQuestPostHandler({
  readConfig: () => baseConfig,
  generate: async () => {
    throw {
      status: 429,
      headers: { "retry-after": "17" },
      sourceText: "must not be exposed",
    };
  },
});
const rateResponse = await rateLimited(request());
assert.equal(rateResponse.status, 429);
assert.equal(rateResponse.headers.get("retry-after"), "17");
assert.deepEqual(await rateResponse.json(), {
  requestId,
  error: {
    code: "RATE_LIMITED",
    message: "Live AI is busy. Wait briefly or play the ready-made quest.",
    retryAfterSeconds: 17,
  },
});

const safeLogs: Array<Record<string, unknown>> = [];
const invalidCredential = createQuestPostHandler({
  readConfig: () => baseConfig,
  generate: async () => {
    throw {
      status: 401,
      apiKey: "must not be logged",
      sourceText: "must not be logged",
    };
  },
  logFailure: (entry) => safeLogs.push(entry),
});
const credentialResponse = await invalidCredential(request());
assert.equal(credentialResponse.status, 503);
assert.deepEqual(await credentialResponse.json(), {
  requestId,
  error: {
    code: "OPENAI_AUTH_FAILED",
    message:
      "OpenAI rejected the deployment credential. Replace OPENAI_API_KEY with a valid project key, then redeploy.",
  },
});
assert.equal(safeLogs.length, 1);
assert.deepEqual(Object.keys(safeLogs[0]!).sort(), [
  "code",
  "durationMs",
  "requestId",
]);
assert.equal(JSON.stringify(safeLogs).includes("must not be logged"), false);

console.log("Quest route safety boundary passed.");
