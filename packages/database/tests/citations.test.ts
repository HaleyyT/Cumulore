import assert from "node:assert/strict";

import { validateCitations } from "../src/citations.js";

const chunk = {
  chunkId: "chunk-1",
  sourceId: "source-1",
  sourceVersionId: "version-1",
  textContent: "Evidence",
  structuralType: "paragraph",
  locator: { page: 2 },
  headingPath: ["Heading"],
  rank: 1,
};

assert.deepEqual(
  validateCitations(
    [
      {
        text: "A supported claim",
        citations: [{ chunkId: "chunk-1", locator: { page: 2 } }],
      },
    ],
    [chunk],
  ),
  {
    status: "grounded",
    claims: [
      {
        text: "A supported claim",
        citations: [{ chunkId: "chunk-1", locator: { page: 2 } }],
      },
    ],
  },
);
assert.deepEqual(
  validateCitations(
    [
      {
        text: "Unsupported",
        citations: [{ chunkId: "other", locator: { page: 2 } }],
      },
    ],
    [chunk],
  ),
  { status: "rejected", reason: "citation_not_in_retrieval_scope" },
);
assert.deepEqual(validateCitations([], [chunk]), {
  status: "insufficient_evidence",
  reason: "no_supporting_chunks",
});
console.log("Citation validation tests passed.");
