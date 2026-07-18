export type SourceSegment = { id: string; text: string };

export function normalizeSourceText(sourceText: string): string {
  return sourceText.replace(/\r\n?/g, "\n").trim();
}

export function segmentSource(
  sourceText: string,
  maxChars = 1500,
): SourceSegment[] {
  const normalized = normalizeSourceText(sourceText);
  if (!normalized) return [];
  const blocks = normalized.split(/\n\s*\n/);
  const chunks = blocks.flatMap((block) => {
    if (block.length <= maxChars) return [block];
    return block.match(new RegExp(`.{1,${maxChars}}(?:\\s|$)`, "g")) ?? [block];
  });
  return chunks.map((text, index) => ({
    id: `S${String(index + 1).padStart(3, "0")}`,
    text: text.trim(),
  }));
}
