import type { RetrievedChunk } from "./retrieval.js";

export type CitationInput = {
  chunkId: string;
  locator: Record<string, string | number>;
};

export type ClaimInput = {
  text: string;
  citations: CitationInput[];
};

export type CitationValidation =
  | { status: "grounded"; claims: ClaimInput[] }
  | { status: "insufficient_evidence"; reason: "no_supporting_chunks" }
  | {
      status: "rejected";
      reason: "citation_not_in_retrieval_scope" | "locator_mismatch";
    };

export function validateCitations(
  claims: ClaimInput[],
  retrievedChunks: RetrievedChunk[],
): CitationValidation {
  if (claims.length === 0 || retrievedChunks.length === 0)
    return { status: "insufficient_evidence", reason: "no_supporting_chunks" };
  const chunks = new Map(
    retrievedChunks.map((chunk) => [chunk.chunkId, chunk]),
  );
  for (const claim of claims) {
    if (!claim.text.trim() || claim.citations.length === 0)
      return {
        status: "insufficient_evidence",
        reason: "no_supporting_chunks",
      };
    for (const citation of claim.citations) {
      const chunk = chunks.get(citation.chunkId);
      if (!chunk)
        return {
          status: "rejected",
          reason: "citation_not_in_retrieval_scope",
        };
      if (JSON.stringify(chunk.locator) !== JSON.stringify(citation.locator))
        return { status: "rejected", reason: "locator_mismatch" };
    }
  }
  return { status: "grounded", claims };
}
