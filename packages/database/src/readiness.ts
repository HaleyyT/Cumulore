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
      reason: "publication_not_eligible" | "evaluation_failed";
    };

/** Combines the approval and quality gates without performing a write. */
export function evaluatePublicationReadiness(
  eligibility: PublicationEligibility,
  evaluation: AnswerEvaluation,
): PublicationReadiness {
  if (eligibility.status !== "eligible") {
    return { status: "blocked", reason: "publication_not_eligible" };
  }
  if (evaluation.status !== "evaluated" || !evaluation.passed) {
    return { status: "blocked", reason: "evaluation_failed" };
  }
  return {
    status: "ready",
    proposalId: eligibility.proposalId,
    proposalVersion: eligibility.proposalVersion,
    contentHash: eligibility.contentHash,
  };
}
