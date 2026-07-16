import { createHash } from "node:crypto";

import type { GroundedAnswer } from "./answer.js";
import { canonicalJson, immutableJsonClone } from "./integrity.js";

export type AnswerProposal = {
  proposalId: string;
  version: number;
  scopeSnapshotId: string;
  sourceVersionIds: string[];
  contentHash: string;
  status: "ready_for_review" | "blocked";
  answer: GroundedAnswer;
};

export type CreateAnswerProposalInput = Omit<
  AnswerProposal,
  "contentHash" | "status"
>;

export function computeProposalContentHash(
  proposal: Pick<
    AnswerProposal,
    "answer" | "scopeSnapshotId" | "sourceVersionIds" | "version"
  >,
): string {
  return createHash("sha256")
    .update(
      canonicalJson({
        answer: proposal.answer,
        scopeSnapshotId: proposal.scopeSnapshotId,
        sourceVersionIds: proposal.sourceVersionIds,
        version: proposal.version,
      }),
    )
    .digest("hex");
}

/** Creates an immutable review envelope; persistence/publication is separate. */
export function createAnswerProposal(
  input: CreateAnswerProposalInput,
): AnswerProposal {
  if (!Number.isInteger(input.version) || input.version < 1) {
    throw new Error("Proposal version must be a positive integer");
  }
  if (input.sourceVersionIds.length === 0) {
    throw new Error("Proposal requires source versions");
  }
  const immutableInput = immutableJsonClone(input);
  const contentHash = computeProposalContentHash(immutableInput);
  return immutableJsonClone({
    ...immutableInput,
    contentHash,
    status:
      immutableInput.answer.status === "grounded"
        ? "ready_for_review"
        : "blocked",
  });
}
