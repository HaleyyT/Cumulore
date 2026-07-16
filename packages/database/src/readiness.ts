import type { AnswerEvaluation } from "./evaluation.js";
import type { PublicationEligibility } from "./publication.js";

export type PublicationReadiness =
  | {
      status: "ready";
      proposalId: string;
      proposalVersion: number;
      contentHash: string;
    }
  | {
      status: "blocked";
      reason:
        | "publication_not_eligible"
        | "evaluation_failed"
        | "evaluation_does_not_match_proposal"
        | "evaluation_not_qualified";
    };

/** Combines the approval and quality gates without performing a write. */
export function evaluatePublicationReadiness(
  eligibility: PublicationEligibility,
  evaluation: AnswerEvaluation,
): PublicationReadiness {
  if (eligibility.status !== "eligible") {
    return { status: "blocked", reason: "publication_not_eligible" };
  }
  if (evaluation.status !== "evaluated" || !evaluation.diagnosticPassed) {
    return { status: "blocked", reason: "evaluation_failed" };
  }
  if (
    evaluation.proposalId !== eligibility.proposalId ||
    evaluation.proposalVersion !== eligibility.proposalVersion ||
    evaluation.contentHash !== eligibility.contentHash
  ) {
    return { status: "blocked", reason: "evaluation_does_not_match_proposal" };
  }
  if (
    !evaluation.qualifiedForPublication ||
    evaluation.evaluatorVersion === "lexical-diagnostic-v2"
  ) {
    return { status: "blocked", reason: "evaluation_not_qualified" };
  }
  return {
    status: "ready",
    proposalId: eligibility.proposalId,
    proposalVersion: eligibility.proposalVersion,
    contentHash: eligibility.contentHash,
  };
}
