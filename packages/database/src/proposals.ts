import { createHash } from "node:crypto";

import type { GroundedAnswer } from "./answer.js";

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
  const contentHash = createHash("sha256")
    .update(
      JSON.stringify({
        answer: input.answer,
        scopeSnapshotId: input.scopeSnapshotId,
        sourceVersionIds: input.sourceVersionIds,
        version: input.version,
      }),
    )
    .digest("hex");
  return {
    ...input,
    contentHash,
    status: input.answer.status === "grounded" ? "ready_for_review" : "blocked",
  };
}
