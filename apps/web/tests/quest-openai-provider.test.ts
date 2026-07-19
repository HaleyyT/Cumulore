import assert from "node:assert/strict";

import {
  OpenAIQuestProvider,
  type QuestResponsesClient,
} from "../src/modules/quest/generation/openai-provider.js";
import { safeGenerationFailure } from "../src/modules/quest/generation/errors.js";

const config = {
  provider: "openai" as const,
  liveEnabled: true,
  apiKey: "test-only-key",
  model: "gpt-5.6-sol",
  timeoutMs: 45000,
  sourceMaxChars: 20000,
};
const input = {
  sourceTitle: "Learning",
  sourceText:
    "Untrusted source text that must stay inside the provider boundary.",
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
  safeGenerationFailure({ status: 503, message: "do not expose source text" }),
  "GENERATION_UNAVAILABLE",
);
assert.equal(
  safeGenerationFailure(new Error("request timeout")),
  "GENERATION_TIMEOUT",
);

const repair = new OpenAIQuestProvider(config, () =>
  fakeClient(async (request) => {
    assert.match(request.input, /Repair one educational JSON response/);
    assert.match(request.input, /Validation code: EXCERPT_MISMATCH/);
    return { output_text: '{"repaired":true}' };
  }),
);
assert.deepEqual(
  await repair.repair({ ...input, validationCode: "EXCERPT_MISMATCH" }),
  { repaired: true },
);

console.log("Quest OpenAI provider boundary passed.");
