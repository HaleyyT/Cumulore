import assert from "node:assert/strict";

import {
  OpenAIQuestProvider,
  type QuestResponsesClient,
} from "../src/modules/quest/generation/openai-provider.js";
import { safeGenerationFailure } from "../src/modules/quest/generation/errors.js";
import { segmentSource } from "../src/modules/quest/source-segmentation.js";

const config = {
  provider: "openai" as const,
  liveEnabled: true,
  apiKey: "test-only-key",
  model: "gpt-5.6-sol",
  reasoningEffort: "low" as const,
  timeoutMs: 45000,
  sourceMaxChars: 10000,
  maxOutputTokens: 8000,
};
const input = {
  sourceTitle: "Learning",
  sourceSegments: segmentSource(
    "Untrusted source text that must stay inside the provider boundary.",
  ),
  difficulty: "medium" as const,
};

function fakeClient(
  create: QuestResponsesClient["responses"]["create"],
): QuestResponsesClient {
  return { responses: { create } };
}

let calls = 0;
const provider = new OpenAIQuestProvider(config, () =>
  fakeClient(async () => {
    calls += 1;
    return { output_text: '{"ok":true}' };
  }),
);
assert.deepEqual(await provider.generate(input), { ok: true });
assert.equal(calls, 1);

let disabledFactoryCalls = 0;
const disabled = new OpenAIQuestProvider(
  { ...config, liveEnabled: false, apiKey: undefined },
  () => {
    disabledFactoryCalls += 1;
    return fakeClient(async () => ({ output_text: "{}" }));
  },
);
await assert.rejects(() => disabled.generate(input), /LIVE_MODE_DISABLED/);
assert.equal(disabledFactoryCalls, 0, "disabled live mode makes no SDK call");

for (const output of [undefined, "not-json"]) {
  const invalid = new OpenAIQuestProvider(config, () =>
    fakeClient(async () => ({ output_text: output })),
  );
  await assert.rejects(() => invalid.generate(input), /GENERATION_INVALID/);
}

const providerFailure = { status: 429, message: "do not expose source text" };
const rateLimited = new OpenAIQuestProvider(config, () =>
  fakeClient(async () => {
    throw providerFailure;
  }),
);
await assert.rejects(
  () => rateLimited.generate(input),
  (error) => {
    assert.equal(error, providerFailure);
    return true;
  },
);
assert.equal(safeGenerationFailure(providerFailure), "RATE_LIMITED");
assert.equal(
  safeGenerationFailure({ status: 400, message: "private provider detail" }),
  "OPENAI_REQUEST_REJECTED",
);
assert.equal(
  safeGenerationFailure({ status: 401, message: "private provider detail" }),
  "OPENAI_AUTH_FAILED",
);
assert.equal(
  safeGenerationFailure({ status: 403, message: "private provider detail" }),
  "OPENAI_ACCESS_DENIED",
);
assert.equal(
  safeGenerationFailure({ status: 404, message: "private provider detail" }),
  "OPENAI_MODEL_UNAVAILABLE",
);
assert.equal(
  safeGenerationFailure({
    status: 429,
    code: "insufficient_quota",
    message: "private provider detail",
  }),
  "OPENAI_QUOTA_EXHAUSTED",
);
assert.equal(
  safeGenerationFailure({ status: 503, message: "do not expose source text" }),
  "GENERATION_UNAVAILABLE",
);
assert.equal(
  safeGenerationFailure(new Error("request timeout")),
  "GENERATION_TIMEOUT",
);

const repair = new OpenAIQuestProvider(config, () =>
  fakeClient(async (request) => {
    const payload = JSON.stringify(request.input);
    assert.match(payload, /Regenerate one complete corrected quest/);
    assert.match(payload, /EXCERPT_MISMATCH/);
    assert.doesNotMatch(payload, /stack trace|internal log/i);
    return { output_text: '{"repaired":true}' };
  }),
);
assert.deepEqual(
  await repair.repair({
    ...input,
    repair: {
      validationCode: "EXCERPT_MISMATCH",
      affectedIds: ["question-1"],
      fieldPaths: ["stages[0].questions[0].evidence[0].excerpt"],
    },
  }),
  { repaired: true },
);

const incomplete = new OpenAIQuestProvider(config, () =>
  fakeClient(async () => ({ status: "incomplete", output_text: "{}" })),
);
await assert.rejects(() => incomplete.generate(input), /GENERATION_INVALID/);

console.log("Quest OpenAI provider boundary passed.");
