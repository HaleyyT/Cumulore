import assert from "node:assert/strict";

import { buildGroundedAnswer } from "../src/answer.js";
import { rerankRetrievedChunks } from "../src/reranking.js";

const chunks = [
  {
    chunkId: "chunk-b",
    sourceId: "source-1",
    sourceVersionId: "version-1",
    textContent: "The retention policy is documented here.",
    structuralType: "paragraph",
    locator: { page: 3 },
    headingPath: ["Other"],
    rank: 0.9,
  },
  {
    chunkId: "chunk-a",
    sourceId: "source-1",
    sourceVersionId: "version-1",
    textContent: "Retention policy details and review timing.",
    structuralType: "paragraph",
    locator: { page: 2 },
    headingPath: ["Retention Policy"],
    rank: 0.8,
  },
];

assert.equal(
  rerankRetrievedChunks(chunks, "retention policy", 1)[0]?.chunkId,
  "chunk-a",
);
assert.deepEqual(rerankRetrievedChunks([], "anything"), []);

assert.deepEqual(
  buildGroundedAnswer(
    "The policy is reviewed annually.",
    [
      {
        text: "The policy is reviewed annually.",
        citations: [{ chunkId: "chunk-a", locator: { page: 2 } }],
      },
    ],
    chunks,
  ),
  {
    status: "grounded",
    answerText: "The policy is reviewed annually.",
    claims: [
      {
        text: "The policy is reviewed annually.",
        citations: [{ chunkId: "chunk-a", locator: { page: 2 } }],
      },
    ],
    citations: [{ chunkId: "chunk-a", locator: { page: 2 } }],
  },
);
assert.equal(
  buildGroundedAnswer(
    "Unsupported",
    [{ text: "Unsupported", citations: [{ chunkId: "missing", locator: {} }] }],
    chunks,
  ).status,
  "rejected",
);
assert.equal(
  buildGroundedAnswer("No evidence", [], chunks).status,
  "insufficient_evidence",
);
console.log("Reranking and grounded answer tests passed.");
