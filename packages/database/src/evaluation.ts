import type { GroundedAnswer } from "./answer.js";
import { assessClaimSupport } from "./support.js";
import type { RetrievedChunk } from "./retrieval.js";

export type AnswerEvaluation =
  | {
      status: "evaluated";
      evaluatorVersion: "lexical-support-v1";
      claimCount: number;
      citationCount: number;
      supportCoverage: number;
      passed: boolean;
    }
  | {
      status: "not_evaluable";
      reason: "answer_not_grounded";
    };

/** Produces deterministic quality evidence without logging answer content. */
export function evaluateGroundedAnswer(
  answer: GroundedAnswer,
  retrievedChunks: RetrievedChunk[],
): AnswerEvaluation {
  if (answer.status !== "grounded") {
    return { status: "not_evaluable", reason: "answer_not_grounded" };
  }
  const support = answer.claims.map((claim) =>
    assessClaimSupport(claim, retrievedChunks),
  );
  const supportCoverage =
    support.reduce(
      (total, result) =>
        total + (result.status === "supported" ? result.coverage : 0),
      0,
    ) / Math.max(1, support.length);
  return {
    status: "evaluated",
    evaluatorVersion: "lexical-support-v1",
    claimCount: answer.claims.length,
    citationCount: answer.citations.length,
    supportCoverage,
    passed:
      support.length > 0 &&
      support.every((result) => result.status === "supported"),
  };
}
