import {
  computeProposalContentHash,
  type AnswerProposal,
} from "./proposals.js";
import type { ProposalReviewDecision } from "./review.js";

export type PublicationEligibility =
  | {
      status: "eligible";
      proposalId: string;
      proposalVersion: number;
      contentHash: string;
    }
  | {
      status: "blocked";
      reason:
        | "proposal_not_grounded"
        | "proposal_not_approved"
        | "proposal_content_hash_invalid"
        | "review_does_not_match_proposal";
    };

/**
 * Checks the immutable publication boundary. The caller still needs an
 * ownership-aware persistence operation to publish anything.
 */
export function evaluatePublicationEligibility(
  proposal: AnswerProposal,
  decision: ProposalReviewDecision,
): PublicationEligibility {
  if (
    proposal.status !== "ready_for_review" ||
    proposal.answer.status !== "grounded"
  ) {
    return { status: "blocked", reason: "proposal_not_grounded" };
  }
  if (computeProposalContentHash(proposal) !== proposal.contentHash) {
    return { status: "blocked", reason: "proposal_content_hash_invalid" };
  }
  if (decision.decision !== "approved") {
    return { status: "blocked", reason: "proposal_not_approved" };
  }
  if (
    decision.proposalId !== proposal.proposalId ||
    decision.proposalVersion !== proposal.version ||
    decision.contentHash !== proposal.contentHash
  ) {
    return { status: "blocked", reason: "review_does_not_match_proposal" };
  }
  return {
    status: "eligible",
    proposalId: proposal.proposalId,
    proposalVersion: proposal.version,
    contentHash: proposal.contentHash,
  };
}
