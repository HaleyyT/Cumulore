import type { PublicationIntent } from "./intent.js";

export type PublicationIntentResolution =
  | {
      status: "ready_to_apply";
      intentId: string;
      artifactId: string;
      resultingArtifactVersion: number;
    }
  | {
      status: "conflict";
      intentId: string;
      expectedArtifactVersion: number;
      actualArtifactVersion: number;
    }
  | { status: "blocked"; reason: "intent_not_pending" };

/** Resolves the version fence without opening a transaction or writing data. */
export function resolvePublicationIntent(
  intent: PublicationIntent,
  actualArtifactVersion: number,
): PublicationIntentResolution {
  if (intent.status !== "pending_persistence") {
    return { status: "blocked", reason: "intent_not_pending" };
  }
  if (actualArtifactVersion !== intent.expectedArtifactVersion) {
    return {
      status: "conflict",
      intentId: intent.intentId,
      expectedArtifactVersion: intent.expectedArtifactVersion,
      actualArtifactVersion,
    };
  }
  return {
    status: "ready_to_apply",
    intentId: intent.intentId,
    artifactId: intent.targetArtifactId,
    resultingArtifactVersion: intent.resultingArtifactVersion,
  };
}
