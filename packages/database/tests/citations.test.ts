import assert from "node:assert/strict";

import { validateCitations } from "../src/citations.js";

const page2 = {
  locator_version: 1,
  format: "pdf",
  segments: [{ kind: "page", index: 2 }],
};
const chunk = {
  chunkId: "chunk-1",
  sourceId: "source-1",
  sourceVersionId: "version-1",
  textContent: "Evidence",
  structuralType: "paragraph",
  locator: page2,
  headingPath: ["Heading"],
  rank: 1,
};

assert.deepEqual(
  validateCitations(
    [
      {
        text: "A supported claim",
        citations: [{ chunkId: "chunk-1", locator: page2 }],
      },
    ],
    [chunk],
  ),
  {
    status: "grounded",
    claims: [
      {
        text: "A supported claim",
        citations: [{ chunkId: "chunk-1", locator: page2 }],
      },
    ],
  },
);
assert.deepEqual(
  validateCitations(
    [
      {
        text: "Unsupported",
        citations: [{ chunkId: "other", locator: page2 }],
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
assert.equal(
  validateCitations(
    [
      {
        text: "Canonical locator ordering",
        citations: [
          {
            chunkId: "chunk-1",
            locator: {
              format: "pdf",
              locator_version: 1,
              segments: [{ index: 2, kind: "page" }],
            },
          },
        ],
      },
    ],
    [
      {
        ...chunk,
        locator: {
          segments: [{ kind: "page", index: 2 }],
          locator_version: 1,
          format: "pdf",
        },
      },
    ],
  ).status,
  "grounded",
  "locator comparison is independent of object key insertion order",
);
assert.deepEqual(
  validateCitations(
    [{ text: "Legacy", citations: [{ chunkId: "chunk-1", locator: {} }] }],
    [{ ...chunk, locator: {} }],
  ),
  { status: "rejected", reason: "locator_version_invalid" },
  "legacy locators remain migration-readable but are not citable",
);
assert.deepEqual(
  validateCitations(
    [
      {
        text: "Malformed",
        citations: [
          {
            chunkId: "chunk-1",
            locator: { ...page2, segments: [{ kind: "page", index: -1 }] },
          },
        ],
      },
    ],
    [
      {
        ...chunk,
        locator: { ...page2, segments: [{ kind: "page", index: -1 }] },
      },
    ],
  ),
  { status: "rejected", reason: "locator_version_invalid" },
  "citation callers cannot bypass the database locator shape contract",
);
console.log("Citation validation tests passed.");
