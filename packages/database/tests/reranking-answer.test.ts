import assert from "node:assert/strict";

import { buildGroundedAnswer } from "../src/answer.js";
import { createPublicationCommand } from "../src/command.js";
import { createPublicationOutcome } from "../src/outcome.js";
import { evaluateGroundedAnswer } from "../src/evaluation.js";
import { createPublicationIntent } from "../src/intent.js";
import { resolvePublicationIntent } from "../src/intent-resolution.js";
import { createAnswerProposal } from "../src/proposals.js";
import { evaluatePublicationEligibility } from "../src/publication.js";
import { evaluatePublicationReadiness } from "../src/readiness.js";
import { rerankRetrievedChunks } from "../src/reranking.js";
import { reviewAnswerProposal } from "../src/review.js";
import { assessClaimSupport } from "../src/support.js";

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
  assessClaimSupport(
    {
      text: "Retention policy review timing",
      citations: [{ chunkId: "chunk-a", locator: { page: 2 } }],
    },
    chunks,
  ),
  { status: "supported", coverage: 1 },
);
assert.deepEqual(
  assessClaimSupport(
    {
      text: "The policy is reviewed annually",
      citations: [{ chunkId: "chunk-a", locator: { page: 2 } }],
    },
    chunks,
  ),
  { status: "insufficient_evidence", coverage: 1 / 3 },
);

const grounded = buildGroundedAnswer(
  "Retention policy review timing.",
  [
    {
      text: "Retention policy review timing",
      citations: [{ chunkId: "chunk-a", locator: { page: 2 } }],
    },
  ],
  chunks,
);
assert.deepEqual(grounded, {
  status: "grounded",
  answerText: "Retention policy review timing.",
  claims: [
    {
      text: "Retention policy review timing",
      citations: [{ chunkId: "chunk-a", locator: { page: 2 } }],
    },
  ],
  citations: [{ chunkId: "chunk-a", locator: { page: 2 } }],
});
assert.equal(
  buildGroundedAnswer(
    "The policy is reviewed annually.",
    [
      {
        text: "The policy is reviewed annually",
        citations: [{ chunkId: "chunk-a", locator: { page: 2 } }],
      },
    ],
    chunks,
  ).status,
  "insufficient_evidence",
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

const proposal = createAnswerProposal({
  proposalId: "proposal-1",
  version: 1,
  scopeSnapshotId: "snapshot-1",
  sourceVersionIds: ["version-1"],
  answer: grounded,
});
assert.equal(proposal.status, "ready_for_review");
assert.equal(proposal.contentHash.length, 64);
assert.deepEqual(reviewAnswerProposal(proposal, "reviewer-1", "approved"), {
  proposalId: "proposal-1",
  proposalVersion: 1,
  contentHash: proposal.contentHash,
  reviewerId: "reviewer-1",
  decision: "approved",
});
const approval = reviewAnswerProposal(proposal, "reviewer-1", "approved");
assert.deepEqual(evaluatePublicationEligibility(proposal, approval), {
  status: "eligible",
  proposalId: "proposal-1",
  proposalVersion: 1,
  contentHash: proposal.contentHash,
});
assert.deepEqual(
  evaluatePublicationEligibility(proposal, {
    ...approval,
    contentHash: "changed",
  }),
  { status: "blocked", reason: "review_does_not_match_proposal" },
);
assert.deepEqual(evaluateGroundedAnswer(grounded, chunks), {
  status: "evaluated",
  evaluatorVersion: "lexical-support-v1",
  claimCount: 1,
  citationCount: 1,
  supportCoverage: 1,
  passed: true,
});
assert.deepEqual(
  evaluateGroundedAnswer(
    buildGroundedAnswer("No evidence", [], chunks),
    chunks,
  ),
  { status: "not_evaluable", reason: "answer_not_grounded" },
);
assert.deepEqual(
  evaluatePublicationReadiness(
    evaluatePublicationEligibility(proposal, approval),
    evaluateGroundedAnswer(grounded, chunks),
  ),
  {
    status: "ready",
    proposalId: "proposal-1",
    proposalVersion: 1,
    contentHash: proposal.contentHash,
  },
);
assert.deepEqual(
  evaluatePublicationReadiness(
    evaluatePublicationEligibility(proposal, approval),
    { status: "not_evaluable", reason: "answer_not_grounded" },
  ),
  { status: "blocked", reason: "evaluation_failed" },
);
const readiness = evaluatePublicationReadiness(
  evaluatePublicationEligibility(proposal, approval),
  evaluateGroundedAnswer(grounded, chunks),
);
const intent = createPublicationIntent({
  intentId: "intent-1",
  readiness,
  targetArtifactId: "artifact-1",
  expectedArtifactVersion: 4,
  actorId: "user-1",
});
assert.equal(intent.resultingArtifactVersion, 5);
assert.equal(intent.intentHash.length, 64);
assert.deepEqual(resolvePublicationIntent(intent, 4), {
  status: "ready_to_apply",
  intentId: "intent-1",
  artifactId: "artifact-1",
  resultingArtifactVersion: 5,
});
assert.deepEqual(resolvePublicationIntent(intent, 3), {
  status: "conflict",
  intentId: "intent-1",
  expectedArtifactVersion: 4,
  actualArtifactVersion: 3,
});
const resolution = resolvePublicationIntent(intent, 4);
const command = createPublicationCommand(intent, resolution);
assert.equal(command.commandId, "publish:intent-1");
assert.equal(command.idempotencyKey.length, 64);
assert.equal(command.status, "ready");
assert.throws(
  () => createPublicationCommand(intent, resolvePublicationIntent(intent, 3)),
  /matching ready intent/,
);
assert.deepEqual(
  createPublicationOutcome(command, {
    status: "applied",
    artifactVersion: 5,
  }),
  {
    status: "applied",
    artifactVersion: 5,
    commandId: command.commandId,
    idempotencyKey: command.idempotencyKey,
  },
);
const failedOutcome = createPublicationOutcome(command, {
  status: "failed",
  errorCode: "transient",
});
assert.equal(failedOutcome.status, "failed");
if (failedOutcome.status === "failed") {
  assert.equal(failedOutcome.errorCode, "transient");
}
assert.throws(
  () =>
    createPublicationOutcome(command, {
      status: "conflict",
      actualArtifactVersion: 4,
    }),
  /changed version/,
);
assert.throws(
  () =>
    createPublicationIntent({
      intentId: "intent-2",
      readiness: { status: "blocked", reason: "evaluation_failed" },
      targetArtifactId: "artifact-1",
      expectedArtifactVersion: 4,
      actorId: "user-1",
    }),
  /requires readiness/,
);
assert.throws(
  () => reviewAnswerProposal(proposal, "reviewer-1", "rejected"),
  /require a reason/,
);
assert.throws(
  () => createAnswerProposal({ ...proposal, version: 0 }),
  /positive integer/,
);
console.log("Reranking, support, and proposal tests passed.");
