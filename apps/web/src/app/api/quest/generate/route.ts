import { NextResponse } from "next/server";
import { OpenAIQuestProvider } from "../../../../modules/quest/generation/openai-provider";
import { safeGenerationFailure } from "../../../../modules/quest/generation/errors";
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
  const requestId = data.get("requestId");
  const sourceTitle = data.get("sourceTitle");
  const sourceText = data.get("sourceText");
  const difficulty = data.get("requestedDifficulty");
  if (
    typeof requestId !== "string" ||
    typeof sourceTitle !== "string" ||
    typeof sourceText !== "string" ||
    !["easy", "medium", "hard"].includes(String(difficulty))
  )
    return failure(undefined, "INVALID_REQUEST", 400);
  if (!config.liveEnabled) return failure(requestId, "LIVE_MODE_DISABLED", 503);
  if (sourceText.length < 500 || sourceText.length > config.sourceMaxChars)
    return failure(requestId, "SOURCE_TOO_LARGE", 413);
  try {
    const level = difficulty as "easy" | "medium" | "hard";
    const quest = await new OpenAIQuestProvider(config).generate({
      sourceTitle: sourceTitle.trim(),
      sourceText,
      difficulty: level,
    });
    if (
      !validateQuestSemantics(quest as never, segmentSource(sourceText), level)
        .ok
    )
      return failure(requestId, "GENERATION_INVALID", 422);
    return NextResponse.json({ requestId, mode: "live", quest });
  } catch (error) {
    const code = safeGenerationFailure(error);
    return failure(
      requestId,
      code,
      code === "RATE_LIMITED" ? 429 : code === "GENERATION_INVALID" ? 422 : 503,
    );
  }
}
