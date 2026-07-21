import assert from "node:assert/strict";
import { safeGenerationFailure } from "../src/modules/quest/generation/errors.js";

assert.equal(
  safeGenerationFailure(new Error("LIVE_MODE_DISABLED")),
  "LIVE_MODE_DISABLED",
);
assert.equal(safeGenerationFailure({ status: 429 }), "RATE_LIMITED");
assert.equal(safeGenerationFailure({ status: 503 }), "GENERATION_UNAVAILABLE");
assert.equal(
  safeGenerationFailure(new Error("request timeout")),
  "GENERATION_TIMEOUT",
);
const namedTimeout = new Error("Connection error");
namedTimeout.name = "APIConnectionTimeoutError";
assert.equal(safeGenerationFailure(namedTimeout), "GENERATION_TIMEOUT");
assert.equal(
  safeGenerationFailure({ code: "ETIMEDOUT" }),
  "GENERATION_TIMEOUT",
);
assert.equal(
  safeGenerationFailure(new Error("GENERATION_INVALID")),
  "GENERATION_INVALID",
);
assert.equal(
  safeGenerationFailure(new Error("GENERATION_OUTPUT_LIMIT")),
  "GENERATION_OUTPUT_LIMIT",
);
assert.equal(
  safeGenerationFailure(new Error("unexpected")),
  "GENERATION_UNAVAILABLE",
);
console.log("Quest provider safe failure mapping passed.");
