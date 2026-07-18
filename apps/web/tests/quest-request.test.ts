import assert from "node:assert/strict";
import { parseLiveQuestRequest } from "../src/modules/quest/generation/request.js";

const valid = {
  requestId: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  sourceTitle: "Source",
  sourceText: "x".repeat(500),
  requestedDifficulty: "medium",
  mode: "live",
  consent: "true",
};
assert.deepEqual(parseLiveQuestRequest(valid), {
  requestId: valid.requestId,
  sourceTitle: "Source",
  sourceText: valid.sourceText,
  difficulty: "medium",
});
assert.equal(parseLiveQuestRequest({ ...valid, consent: "false" }), undefined);
assert.equal(parseLiveQuestRequest({ ...valid, requestId: "bad" }), undefined);
assert.equal(
  parseLiveQuestRequest({ ...valid, unexpected: "field" }),
  undefined,
);
console.log("Quest live request boundary passed.");
