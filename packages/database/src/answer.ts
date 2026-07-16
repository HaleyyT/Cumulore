import type { ClaimInput, CitationInput } from "./citations.js";
import { validateCitations } from "./citations.js";
import type { RetrievedChunk } from "./retrieval.js";
import { assessClaimSupport } from "./support.js";

export type GroundedAnswer =
  | {
      status: "grounded";
      answerText: string;
      claims: ClaimInput[];
      citations: CitationInput[];
    }
  | {
      status: "insufficient_evidence" | "rejected";
      answerText: string;
      claims: [];
      citations: [];
    };

/**
 * Builds the answer boundary without calling a model or publishing content.
 * Unsupported or malformed claims are replaced by a safe visible status.
 */
export function buildGroundedAnswer(
  answerText: string,
  claims: ClaimInput[],
  retrievedChunks: RetrievedChunk[],
): GroundedAnswer {
  const validation = validateCitations(claims, retrievedChunks);
  if (validation.status === "insufficient_evidence") {
    return {
      status: "insufficient_evidence",
      answerText:
        "Insufficient evidence to answer from the authorized sources.",
      claims: [],
      citations: [],
    };
  }
  if (validation.status === "rejected") {
    return {
      status: "rejected",
      answerText: "The answer could not be grounded in the authorized sources.",
      claims: [],
      citations: [],
    };
  }
  const support = validation.claims.map((claim) =>
    assessClaimSupport(claim, retrievedChunks),
  );
  if (support.some((result) => result.status === "rejected")) {
    return {
      status: "rejected",
      answerText: "The answer could not be grounded in the authorized sources.",
      claims: [],
      citations: [],
    };
  }
  if (support.some((result) => result.status === "insufficient_evidence")) {
    return {
      status: "insufficient_evidence",
      answerText:
        "Insufficient evidence to answer from the authorized sources.",
      claims: [],
      citations: [],
    };
  }
  return {
    status: "grounded",
    answerText,
    claims: validation.claims,
    citations: validation.claims.flatMap((claim) => claim.citations),
  };
}
