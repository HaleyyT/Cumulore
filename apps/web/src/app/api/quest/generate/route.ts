import { NextResponse } from "next/server";
import { OpenAIQuestProvider } from "../../../../modules/quest/generation/openai-provider";
import { safeGenerationFailure } from "../../../../modules/quest/generation/errors";
import { parseLiveQuestRequest } from "../../../../modules/quest/generation/request";
import { readQuestRuntimeConfig } from "../../../../modules/quest/runtime-config";
import { segmentSource } from "../../../../modules/quest/source-segmentation";
import { validateQuestSemantics } from "../../../../modules/quest/validation";

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

export async function POST(request: Request) {
  const config = readQuestRuntimeConfig();
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
    const quest = await new OpenAIQuestProvider(config).generate({
      ...input,
    });
    if (
      !validateQuestSemantics(
        quest as never,
        segmentSource(input.sourceText),
        input.difficulty,
      ).ok
    )
      return failure(input.requestId, "GENERATION_INVALID", 422);
    return NextResponse.json({
      requestId: input.requestId,
      mode: "live",
      quest,
    });
  } catch (error) {
    const code = safeGenerationFailure(error);
    return failure(
      input.requestId,
      code,
      code === "RATE_LIMITED" ? 429 : code === "GENERATION_INVALID" ? 422 : 503,
    );
  }
}
