export type SourceSegment = { id: string; text: string };

export function normalizeSourceText(sourceText: string): string {
  return sourceText.replace(/\r\n?/g, "\n").trim();
}

export function segmentSource(
  sourceText: string,
  maxChars = 1500,
): SourceSegment[] {
  if (!Number.isInteger(maxChars) || maxChars < 1)
    throw new Error("Source segment size must be a positive integer");
  const normalized = normalizeSourceText(sourceText);
  if (!normalized) return [];
  const blocks = normalized.split(/\n\s*\n/);
  const chunks = blocks.flatMap((block) => splitBlock(block, maxChars));
  return chunks.map((text, index) => ({
    id: `S${String(index + 1).padStart(3, "0")}`,
    text: text.trim(),
  }));
}

function splitBlock(block: string, maxChars: number): string[] {
  const chunks: string[] = [];
  let remainder = block.trim();

  while (remainder.length > maxChars) {
    const candidate = remainder.slice(0, maxChars + 1);
    const whitespace = Math.max(
      candidate.lastIndexOf(" "),
      candidate.lastIndexOf("\n"),
      candidate.lastIndexOf("\t"),
    );
    const splitAt =
      whitespace > 0 && whitespace >= Math.max(1, Math.floor(maxChars * 0.6))
        ? whitespace
        : maxChars;
    chunks.push(remainder.slice(0, splitAt).trim());
    remainder = remainder.slice(splitAt).trimStart();
  }

  if (remainder) chunks.push(remainder);
  return chunks;
}
