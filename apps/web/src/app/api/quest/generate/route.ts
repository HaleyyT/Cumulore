import { NextResponse } from "next/server";
import { OpenAIQuestProvider } from "../../../../modules/quest/generation/openai-provider";
import { safeGenerationError } from "../../../../modules/quest/generation/errors";
import { parseLiveQuestRequest } from "../../../../modules/quest/generation/request";
import { QuestService } from "../../../../modules/quest/generation/quest-service";
import { readQuestRuntimeConfig } from "../../../../modules/quest/runtime-config";
import type { QuestServiceResult } from "../../../../modules/quest/generation/quest-service";
import type { LiveQuestRequest } from "../../../../modules/quest/generation/request";
import type { QuestRuntimeConfig } from "../../../../modules/quest/runtime-config";

export const runtime = "nodejs";
// One initial provider call plus one bounded validation repair can each consume
// the configured 45-second provider timeout. Keep the hosting deadline above
// that 90-second worst case so Vercel returns our safe response instead of a
// platform-generated 504.
export const maxDuration = 120;

const safeMessage: Readonly<Record<string, string>> = {
  INVALID_REQUEST: "Check the title, source text, difficulty, and consent.",
  SOURCE_TOO_SHORT: "Use at least 100 characters of source material.",
  SOURCE_TOO_LARGE: "Use no more than 10,000 characters of source material.",
  LIVE_MODE_DISABLED:
    "Live AI is not enabled for this deployment. Deterministic Demo is still available.",
  OPENAI_AUTH_FAILED:
    "OpenAI rejected the deployment credential. Replace OPENAI_API_KEY with a valid project key, then redeploy.",
  OPENAI_ACCESS_DENIED:
    "This OpenAI project cannot run the configured quest model. Check its project permissions and model access.",
  OPENAI_MODEL_UNAVAILABLE:
    "The configured OpenAI quest model is unavailable to this project. Check OPENAI_QUEST_MODEL and project access.",
  OPENAI_QUOTA_EXHAUSTED:
    "The OpenAI project's available quota is exhausted. Check its billing and spending limit.",
  OPENAI_REQUEST_REJECTED:
    "OpenAI rejected the quest request configuration. Use the documented model settings or Deterministic Demo.",
  RATE_LIMITED: "Live AI is busy. Wait briefly or use Deterministic Demo.",
  GENERATION_TIMEOUT:
    "Quest generation took too long. Try a shorter source or use Deterministic Demo.",
  GENERATION_INVALID:
    "The generated quest did not pass its evidence checks. Try again or use Deterministic Demo.",
  GENERATION_UNAVAILABLE:
    "Live generation is temporarily unavailable. Use Deterministic Demo.",
};

const failure = (
  requestId: string | undefined,
  code: string,
  status: number,
  retryAfterSeconds?: number,
) => {
  const response = NextResponse.json(
    {
      requestId,
      error: {
        code,
        message: safeMessage[code] ?? safeMessage.GENERATION_UNAVAILABLE,
        ...(retryAfterSeconds ? { retryAfterSeconds } : {}),
      },
    },
    { status },
  );
  if (retryAfterSeconds)
    response.headers.set("Retry-After", String(retryAfterSeconds));
  return response;
};

type QuestRouteDependencies = {
  readConfig: () => QuestRuntimeConfig;
  generate: (
    config: QuestRuntimeConfig,
    input: LiveQuestRequest,
  ) => Promise<QuestServiceResult>;
  logFailure?: (entry: {
    requestId: string;
    code: string;
    durationMs: number;
  }) => void;
};

const logFailure: NonNullable<QuestRouteDependencies["logFailure"]> = (
  entry,
) => {
  console.error(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "error",
      service: "web",
      operation: "quest.generate",
      correlation_id: entry.requestId,
      duration_ms: entry.durationMs,
      outcome: "failed",
      safe_error_code: entry.code.toLowerCase(),
    }),
  );
};

const productionDependencies: QuestRouteDependencies = {
  readConfig: readQuestRuntimeConfig,
  generate: (config, input) =>
    new QuestService(new OpenAIQuestProvider(config)).generate(input),
  logFailure,
};

export function createQuestPostHandler(
  dependencies: QuestRouteDependencies = productionDependencies,
) {
  return async function post(request: Request) {
    let config: QuestRuntimeConfig;
    try {
      config = dependencies.readConfig();
    } catch {
      return failure(undefined, "LIVE_MODE_DISABLED", 503);
    }
    const contentLength = Number(request.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > 16000)
      return failure(undefined, "SOURCE_TOO_LARGE", 413);
    let data: FormData;
    try {
      data = await request.formData();
    } catch {
      return failure(undefined, "INVALID_REQUEST", 400);
    }
    const values: Record<string, FormDataEntryValue> = {};
    for (const [key, value] of data.entries()) {
      if (key in values) return failure(undefined, "INVALID_REQUEST", 400);
      values[key] = value;
    }
    const input = parseLiveQuestRequest(values);
    if (!input) return failure(undefined, "INVALID_REQUEST", 400);
    if (!config.liveEnabled || config.provider !== "openai")
      return failure(input.requestId, "LIVE_MODE_DISABLED", 503);
    if (input.sourceText.trim().length < 100)
      return failure(input.requestId, "SOURCE_TOO_SHORT", 400);
    if (input.sourceText.trim().length > config.sourceMaxChars)
      return failure(input.requestId, "SOURCE_TOO_LARGE", 413);
    const startedAt = Date.now();
    try {
      const result = await dependencies.generate(config, input);
      if (!result.ok) {
        dependencies.logFailure?.({
          requestId: input.requestId,
          code: "GENERATION_INVALID",
          durationMs: Date.now() - startedAt,
        });
        return failure(input.requestId, "GENERATION_INVALID", 422);
      }
      return NextResponse.json({
        requestId: input.requestId,
        mode: "live",
        quest: result.quest,
      });
    } catch (error) {
      const { code, retryAfterSeconds } = safeGenerationError(error);
      dependencies.logFailure?.({
        requestId: input.requestId,
        code,
        durationMs: Date.now() - startedAt,
      });
      return failure(
        input.requestId,
        code,
        code === "RATE_LIMITED"
          ? 429
          : code === "GENERATION_INVALID"
            ? 422
            : 503,
        retryAfterSeconds,
      );
    }
  };
}

export const POST = createQuestPostHandler();
