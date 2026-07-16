import {
  computeProposalContentHash,
  type AnswerProposal,
} from "./proposals.js";

export type ProposalReviewDecision = {
  proposalId: string;
  proposalVersion: number;
  contentHash: string;
  reviewerId: string;
  decision: "approved" | "rejected";
  reason?: string;
};

/** Records a review decision without mutating the proposal or publishing it. */
export function reviewAnswerProposal(
  proposal: AnswerProposal,
  reviewerId: string,
  decision: "approved" | "rejected",
  reason?: string,
): ProposalReviewDecision {
  if (proposal.status !== "ready_for_review") {
    throw new Error("Only grounded proposals can be reviewed");
  }
  if (computeProposalContentHash(proposal) !== proposal.contentHash) {
    throw new Error("Proposal content hash does not match its content");
  }
  if (!reviewerId.trim()) throw new Error("Reviewer is required");
  if (decision === "rejected" && !reason?.trim()) {
    throw new Error("Rejected proposals require a reason");
  }
  return {
    proposalId: proposal.proposalId,
    proposalVersion: proposal.version,
    contentHash: proposal.contentHash,
    reviewerId,
    decision,
    ...(reason ? { reason } : {}),
  };
}
