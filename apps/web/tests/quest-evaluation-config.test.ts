import assert from "node:assert/strict";

import {
  assertLiveEvaluationEnabled,
  parseEvaluationProvider,
} from "../src/modules/quest/evaluation-config.js";

assert.equal(parseEvaluationProvider(["--provider=fixture"]), "fixture");
assert.equal(parseEvaluationProvider(["--provider=live"]), "live");
assert.throws(
  () => parseEvaluationProvider([]),
  /Choose an evaluation provider/,
);
assert.throws(
  () => parseEvaluationProvider(["--provider=unknown"]),
  /Choose an evaluation provider/,
);
assert.throws(() => assertLiveEvaluationEnabled({}), /QUEST_PROVIDER=openai/);
assert.throws(
  () => assertLiveEvaluationEnabled({ QUEST_PROVIDER: "openai" }),
  /QUEST_LIVE_GENERATION_ENABLED=true/,
);
assert.throws(
  () =>
    assertLiveEvaluationEnabled({
      QUEST_PROVIDER: "openai",
      QUEST_LIVE_GENERATION_ENABLED: "true",
    }),
  /OPENAI_API_KEY/,
);
assert.doesNotThrow(() =>
  assertLiveEvaluationEnabled({
    QUEST_PROVIDER: "openai",
    QUEST_LIVE_GENERATION_ENABLED: "true",
    OPENAI_API_KEY: "test-only-key",
  }),
);

console.log("Quest evaluation configuration passed.");
