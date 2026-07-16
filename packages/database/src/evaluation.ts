import {
  computeProposalContentHash,
  type AnswerProposal,
} from "./proposals.js";
import { assessClaimSupport } from "./support.js";
import type { RetrievedChunk } from "./retrieval.js";

export type AnswerEvaluation =
  | {
      status: "evaluated";
      proposalId: string;
      proposalVersion: number;
      contentHash: string;
      scopeSnapshotId: string;
      sourceVersionIds: string[];
      evaluatorVersion: "lexical-diagnostic-v2";
      policyVersion: "publication-grounding-v1";
      claimCount: number;
      citationCount: number;
      supportCoverage: number;
      diagnosticPassed: boolean;
      qualifiedForPublication: boolean;
    }
  | {
      status: "not_evaluable";
      reason: "answer_not_grounded" | "proposal_content_hash_invalid";
    };

/** Produces deterministic quality evidence without logging answer content. */
export function evaluateGroundedAnswer(
  proposal: AnswerProposal,
  retrievedChunks: RetrievedChunk[],
): AnswerEvaluation {
  if (computeProposalContentHash(proposal) !== proposal.contentHash) {
    return { status: "not_evaluable", reason: "proposal_content_hash_invalid" };
  }
  if (proposal.answer.status !== "grounded") {
    return { status: "not_evaluable", reason: "answer_not_grounded" };
  }
  const support = proposal.answer.claims.map((claim) =>
    assessClaimSupport(claim, retrievedChunks),
  );
  const supportCoverage =
    support.reduce(
      (total, result) =>
        total + (result.status === "supported" ? result.coverage : 0),
      0,
    ) / Math.max(1, support.length);
  return {
    status: "evaluated",
    proposalId: proposal.proposalId,
    proposalVersion: proposal.version,
    contentHash: proposal.contentHash,
    scopeSnapshotId: proposal.scopeSnapshotId,
    sourceVersionIds: [...proposal.sourceVersionIds],
    evaluatorVersion: "lexical-diagnostic-v2",
    policyVersion: "publication-grounding-v1",
    claimCount: proposal.answer.claims.length,
    citationCount: proposal.answer.citations.length,
    supportCoverage,
    diagnosticPassed:
      support.length > 0 &&
      support.every((result) => result.status === "supported"),
    qualifiedForPublication: false,
  };
}
