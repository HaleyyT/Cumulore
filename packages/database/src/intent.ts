import { createHash } from "node:crypto";

import type { PublicationReadiness } from "./readiness.js";

export type PublicationIntent = {
  intentId: string;
  proposalId: string;
  proposalVersion: number;
  contentHash: string;
  targetArtifactId: string;
  expectedArtifactVersion: number;
  resultingArtifactVersion: number;
  actorId: string;
  intentHash: string;
  status: "pending_persistence";
};

export type CreatePublicationIntentInput = {
  intentId: string;
  readiness: PublicationReadiness;
  targetArtifactId: string;
  expectedArtifactVersion: number;
  actorId: string;
};

/** Creates an optimistic-concurrency command; it does not persist or publish. */
export function createPublicationIntent(
  input: CreatePublicationIntentInput,
): PublicationIntent {
  if (input.readiness.status !== "ready") {
    throw new Error("Publication intent requires readiness");
  }
  if (!input.intentId.trim() || !input.targetArtifactId.trim()) {
    throw new Error("Publication intent identifiers are required");
  }
  if (!input.actorId.trim()) throw new Error("Publication actor is required");
  if (
    !Number.isInteger(input.expectedArtifactVersion) ||
    input.expectedArtifactVersion < 0
  ) {
    throw new Error("Expected artifact version must be a non-negative integer");
  }
  const fields = {
    actorId: input.actorId,
    contentHash: input.readiness.contentHash,
    expectedArtifactVersion: input.expectedArtifactVersion,
    intentId: input.intentId,
    proposalId: input.readiness.proposalId,
    targetArtifactId: input.targetArtifactId,
  };
  return {
    intentId: input.intentId,
    proposalId: input.readiness.proposalId,
    proposalVersion: input.readiness.proposalVersion,
    contentHash: input.readiness.contentHash,
    targetArtifactId: input.targetArtifactId,
    expectedArtifactVersion: input.expectedArtifactVersion,
    resultingArtifactVersion: input.expectedArtifactVersion + 1,
    actorId: input.actorId,
    intentHash: createHash("sha256")
      .update(JSON.stringify(fields))
      .digest("hex"),
    status: "pending_persistence",
  };
}
