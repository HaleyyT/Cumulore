import type { ClaimInput } from "./citations.js";
import type { RetrievedChunk } from "./retrieval.js";

export type ClaimSupport =
  | { status: "supported"; coverage: number }
  | { status: "insufficient_evidence"; coverage: number }
  | { status: "rejected"; reason: "citation_not_in_retrieval_scope" };

const ignoredWords = new Set([
  "a",
  "an",
  "and",
  "are",
  "be",
  "by",
  "for",
  "from",
  "in",
  "is",
  "of",
  "on",
  "or",
  "the",
  "to",
  "with",
]);

function meaningfulTokens(value: string): string[] {
  return [
    ...new Set(
      value
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((token) => token.length > 2 && !ignoredWords.has(token)),
    ),
  ];
}

/**
 * Checks lexical support inside the cited, already-authorized chunks. This is
 * deliberately conservative and provider-free; semantic support can be added
 * behind a reviewed adapter later.
 */
export function assessClaimSupport(
  claim: ClaimInput,
  retrievedChunks: RetrievedChunk[],
): ClaimSupport {
  const chunks = new Map(
    retrievedChunks.map((chunk) => [chunk.chunkId, chunk]),
  );
  const citedChunks = claim.citations.map((citation) =>
    chunks.get(citation.chunkId),
  );
  if (citedChunks.some((chunk) => !chunk)) {
    return { status: "rejected", reason: "citation_not_in_retrieval_scope" };
  }
  const claimTokens = meaningfulTokens(claim.text);
  if (claimTokens.length === 0 || citedChunks.length === 0) {
    return { status: "insufficient_evidence", coverage: 0 };
  }
  const evidence = citedChunks
    .filter((chunk): chunk is RetrievedChunk => chunk !== undefined)
    .map((chunk) =>
      `${chunk.headingPath.join(" ")} ${chunk.textContent}`.toLowerCase(),
    )
    .join(" ");
  const matched = claimTokens.filter((token) => evidence.includes(token));
  const coverage = matched.length / claimTokens.length;
  return coverage >= 0.6
    ? { status: "supported", coverage }
    : { status: "insufficient_evidence", coverage };
}
