import type { PublicationCommand } from "./command.js";

export type PublicationOutcomeInput =
  | { status: "applied"; artifactVersion: number }
  | { status: "duplicate"; artifactVersion: number }
  | { status: "conflict"; actualArtifactVersion: number }
  | {
      status: "failed";
      errorCode: "transient" | "non_retryable" | "unknown";
    };

export type PublicationOutcome = PublicationOutcomeInput & {
  commandId: string;
  idempotencyKey: string;
};

/** Records a redacted command outcome; it never includes answer content. */
export function createPublicationOutcome(
  command: PublicationCommand,
  result: PublicationOutcomeInput,
): PublicationOutcome {
  if (result.status === "applied" || result.status === "duplicate") {
    if (result.artifactVersion !== command.resultingArtifactVersion) {
      throw new Error("Publication outcome version does not match command");
    }
  }
  if (
    result.status === "conflict" &&
    result.actualArtifactVersion === command.expectedArtifactVersion
  ) {
    throw new Error("Conflict outcome must report a changed version");
  }
  return {
    ...result,
    commandId: command.commandId,
    idempotencyKey: command.idempotencyKey,
  };
}
