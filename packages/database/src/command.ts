import { createHash } from "node:crypto";

import type { PublicationIntent } from "./intent.js";
import type { PublicationIntentResolution } from "./intent-resolution.js";

export type PublicationCommand = {
  commandId: string;
  idempotencyKey: string;
  intentId: string;
  targetArtifactId: string;
  expectedArtifactVersion: number;
  resultingArtifactVersion: number;
  actorId: string;
  contentHash: string;
  status: "ready";
};

/** Builds a retry-safe command without performing the artifact write. */
export function createPublicationCommand(
  intent: PublicationIntent,
  resolution: PublicationIntentResolution,
): PublicationCommand {
  if (
    resolution.status !== "ready_to_apply" ||
    resolution.intentId !== intent.intentId ||
    resolution.artifactId !== intent.targetArtifactId
  ) {
    throw new Error("Publication command requires a matching ready intent");
  }
  const idempotencyKey = createHash("sha256")
    .update(
      JSON.stringify({
        contentHash: intent.contentHash,
        expectedArtifactVersion: intent.expectedArtifactVersion,
        intentHash: intent.intentHash,
        targetArtifactId: intent.targetArtifactId,
      }),
    )
    .digest("hex");
  return {
    commandId: `publish:${intent.intentId}`,
    idempotencyKey,
    intentId: intent.intentId,
    targetArtifactId: intent.targetArtifactId,
    expectedArtifactVersion: intent.expectedArtifactVersion,
    resultingArtifactVersion: resolution.resultingArtifactVersion,
    actorId: intent.actorId,
    contentHash: intent.contentHash,
    status: "ready",
  };
}
