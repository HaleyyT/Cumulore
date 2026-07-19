const unsupportedOpenAIKeywords = new Set([
  "$id",
  "$schema",
  "maxLength",
  "minLength",
  "uniqueItems",
]);

export function toOpenAIStructuredOutputSchema(value: unknown): unknown {
  if (Array.isArray(value))
    return value.map((item) => toOpenAIStructuredOutputSchema(item));
  if (typeof value !== "object" || value === null) return value;

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !unsupportedOpenAIKeywords.has(key))
      .map(([key, item]) => [key, toOpenAIStructuredOutputSchema(item)]),
  );
}

export function findUnsupportedOpenAIKeywords(
  value: unknown,
  path = "$",
): string[] {
  if (Array.isArray(value))
    return value.flatMap((item, index) =>
      findUnsupportedOpenAIKeywords(item, `${path}[${index}]`),
    );
  if (typeof value !== "object" || value === null) return [];

  return Object.entries(value).flatMap(([key, item]) => [
    ...(unsupportedOpenAIKeywords.has(key) ? [`${path}.${key}`] : []),
    ...findUnsupportedOpenAIKeywords(item, `${path}.${key}`),
  ]);
}
