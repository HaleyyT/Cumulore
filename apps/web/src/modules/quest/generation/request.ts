import type { Difficulty } from "../types";

export type LiveQuestRequest = {
  requestId: string;
  sourceTitle: string;
  sourceText: string;
  difficulty: Difficulty;
};

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseLiveQuestRequest(
  values: Record<string, FormDataEntryValue | undefined>,
): LiveQuestRequest | undefined {
  const allowed = new Set([
    "requestId",
    "sourceTitle",
    "sourceText",
    "requestedDifficulty",
    "mode",
    "consent",
  ]);
  if (
    Object.keys(values).some((key) => !allowed.has(key)) ||
    values.mode !== "live" ||
    values.consent !== "true"
  )
    return undefined;
  const requestId = values.requestId;
  const sourceTitle = values.sourceTitle;
  const sourceText = values.sourceText;
  const difficulty = values.requestedDifficulty;
  if (
    typeof requestId !== "string" ||
    !uuid.test(requestId) ||
    typeof sourceTitle !== "string" ||
    sourceTitle.trim().length < 1 ||
    sourceTitle.trim().length > 120 ||
    typeof sourceText !== "string" ||
    !["easy", "medium", "hard"].includes(String(difficulty))
  )
    return undefined;
  return {
    requestId,
    sourceTitle: sourceTitle.trim(),
    sourceText,
    difficulty: difficulty as Difficulty,
  };
}
