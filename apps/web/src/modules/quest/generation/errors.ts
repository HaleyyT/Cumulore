export type QuestGenerationFailure =
  | "LIVE_MODE_DISABLED"
  | "RATE_LIMITED"
  | "GENERATION_TIMEOUT"
  | "GENERATION_INVALID"
  | "GENERATION_UNAVAILABLE";

export type SafeQuestGenerationFailure = {
  code: QuestGenerationFailure;
  retryAfterSeconds?: number;
};

function retryAfterSeconds(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null || !("headers" in error))
    return undefined;
  const headers = (error as { headers?: unknown }).headers;
  const raw =
    headers instanceof Headers
      ? headers.get("retry-after")
      : typeof headers === "object" && headers !== null
        ? (headers as Record<string, unknown>)["retry-after"]
        : undefined;
  const seconds = Number(raw);
  return Number.isFinite(seconds) && seconds > 0
    ? Math.min(300, Math.ceil(seconds))
    : undefined;
}

export function safeGenerationError(
  error: unknown,
): SafeQuestGenerationFailure {
  return {
    code: safeGenerationFailure(error),
    retryAfterSeconds: retryAfterSeconds(error),
  };
}

export function safeGenerationFailure(error: unknown): QuestGenerationFailure {
  if (error instanceof Error && error.message === "LIVE_MODE_DISABLED")
    return "LIVE_MODE_DISABLED";
  if (typeof error === "object" && error !== null && "status" in error) {
    const status = (error as { status?: unknown }).status;
    if (status === 429) return "RATE_LIMITED";
    if (typeof status === "number" && status >= 500)
      return "GENERATION_UNAVAILABLE";
  }
  if (error instanceof Error && /timeout|abort/i.test(error.message))
    return "GENERATION_TIMEOUT";
  if (error instanceof Error && error.message === "GENERATION_INVALID")
    return "GENERATION_INVALID";
  return "GENERATION_UNAVAILABLE";
}
