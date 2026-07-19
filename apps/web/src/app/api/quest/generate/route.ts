import { NextResponse } from "next/server";
import { OpenAIQuestProvider } from "../../../../modules/quest/generation/openai-provider";
import { safeGenerationFailure } from "../../../../modules/quest/generation/errors";
import { parseLiveQuestRequest } from "../../../../modules/quest/generation/request";
import { QuestService } from "../../../../modules/quest/generation/quest-service";
import { readQuestRuntimeConfig } from "../../../../modules/quest/runtime-config";
import type { QuestServiceResult } from "../../../../modules/quest/generation/quest-service";
import type { LiveQuestRequest } from "../../../../modules/quest/generation/request";
import type { QuestRuntimeConfig } from "../../../../modules/quest/runtime-config";

export const runtime = "nodejs";
const failure = (requestId: string | undefined, code: string, status: number) =>
  NextResponse.json(
    {
      requestId,
      error: {
        code,
        message:
          code === "LIVE_MODE_DISABLED"
            ? "Live AI is unavailable. Use Deterministic Demo."
            : "Live generation is temporarily unavailable. Use Deterministic Demo.",
      },
    },
    { status },
  );

type QuestRouteDependencies = {
  readConfig: () => QuestRuntimeConfig;
  generate: (
    config: QuestRuntimeConfig,
    input: LiveQuestRequest,
  ) => Promise<QuestServiceResult>;
};

const productionDependencies: QuestRouteDependencies = {
  readConfig: readQuestRuntimeConfig,
  generate: (config, input) =>
    new QuestService(new OpenAIQuestProvider(config)).generate(input),
};

export function createQuestPostHandler(
  dependencies: QuestRouteDependencies = productionDependencies,
) {
  return async function post(request: Request) {
    const config = dependencies.readConfig();
    const data = await request.formData();
    const values = Object.fromEntries(data.entries());
    const input = parseLiveQuestRequest(values);
    if (!input) return failure(undefined, "INVALID_REQUEST", 400);
    if (!config.liveEnabled)
      return failure(input.requestId, "LIVE_MODE_DISABLED", 503);
    if (
      input.sourceText.length < 500 ||
      input.sourceText.length > config.sourceMaxChars
    )
      return failure(input.requestId, "SOURCE_TOO_LARGE", 413);
    try {
      const result = await dependencies.generate(config, input);
      if (!result.ok)
        return failure(input.requestId, "GENERATION_INVALID", 422);
      return NextResponse.json({
        requestId: input.requestId,
        mode: "live",
        quest: result.quest,
      });
    } catch (error) {
      const code = safeGenerationFailure(error);
      return failure(
        input.requestId,
        code,
        code === "RATE_LIMITED"
          ? 429
          : code === "GENERATION_INVALID"
            ? 422
            : 503,
      );
    }
  };
}

export const POST = createQuestPostHandler();
