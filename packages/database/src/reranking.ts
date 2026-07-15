import type { RetrievedChunk } from "./retrieval.js";

export type RerankedChunk = RetrievedChunk & { rerankScore: number };

function tokens(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/**
 * Applies a deterministic presentation-level rerank to already authorized
 * candidates. It never broadens the retrieval scope or reads additional data.
 */
export function rerankRetrievedChunks(
  chunks: RetrievedChunk[],
  query: string,
  limit = chunks.length,
): RerankedChunk[] {
  const queryTokens = [...new Set(tokens(query))];
  const phrase = query.trim().toLowerCase();

  return chunks
    .map((chunk) => {
      const text = chunk.textContent.toLowerCase();
      const heading = chunk.headingPath.join(" ").toLowerCase();
      const searchable = `${heading} ${text}`;
      const matched = queryTokens.filter((token) => searchable.includes(token));
      const headingMatches = queryTokens.filter((token) =>
        heading.includes(token),
      );
      const coverage =
        queryTokens.length === 0 ? 0 : matched.length / queryTokens.length;
      const headingCoverage =
        queryTokens.length === 0
          ? 0
          : headingMatches.length / queryTokens.length;
      const phraseBoost = phrase.length > 0 && text.includes(phrase) ? 0.15 : 0;
      const rerankScore =
        (chunk.combinedRank ?? chunk.rank) +
        coverage * 0.2 +
        headingCoverage * 0.25 +
        phraseBoost;
      return { ...chunk, rerankScore };
    })
    .sort(
      (left, right) =>
        right.rerankScore - left.rerankScore ||
        left.sourceVersionId.localeCompare(right.sourceVersionId) ||
        left.chunkId.localeCompare(right.chunkId),
    )
    .slice(0, Math.max(0, limit));
}
