import type { RetrievedChunk } from "./retrieval.js";
import { canonicalJson } from "./integrity.js";

export type CitationInput = {
  chunkId: string;
  locator: Record<string, unknown>;
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
      reason:
        | "citation_not_in_retrieval_scope"
        | "locator_mismatch"
        | "locator_version_invalid";
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
  const validLocator = (locator: Record<string, unknown>): boolean => {
    if (
      locator.locator_version !== 1 ||
      !["pdf", "txt", "pasted_text", "docx", "pptx"].includes(
        String(locator.format),
      ) ||
      !Array.isArray(locator.segments) ||
      locator.segments.length === 0 ||
      locator.segments.length > 32
    )
      return false;
    return locator.segments.every((segment: unknown) => {
      if (
        segment === null ||
        typeof segment !== "object" ||
        Array.isArray(segment)
      )
        return false;
      const value = segment as Record<string, unknown>;
      if (
        !["page", "line", "paragraph", "table", "slide"].includes(
          String(value.kind),
        ) ||
        !Number.isInteger(value.index) ||
        Number(value.index) < 0 ||
        Object.keys(value).some(
          (key) =>
            !["kind", "index", "start_offset", "end_offset"].includes(key),
        )
      )
        return false;
      const hasStart = Object.hasOwn(value, "start_offset");
      const hasEnd = Object.hasOwn(value, "end_offset");
      return (
        (!hasStart && !hasEnd) ||
        (hasStart &&
          hasEnd &&
          Number.isInteger(value.start_offset) &&
          Number.isInteger(value.end_offset) &&
          Number(value.start_offset) >= 0 &&
          Number(value.end_offset) > Number(value.start_offset))
      );
    });
  };
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
      if (!validLocator(chunk.locator) || !validLocator(citation.locator))
        return { status: "rejected", reason: "locator_version_invalid" };
      if (canonicalJson(chunk.locator) !== canonicalJson(citation.locator))
        return { status: "rejected", reason: "locator_mismatch" };
    }
  }
  return { status: "grounded", claims };
}
