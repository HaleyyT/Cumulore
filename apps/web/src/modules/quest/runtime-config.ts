export type QuestRuntimeConfig = {
  provider: "fixture" | "openai";
  liveEnabled: boolean;
  apiKey?: string;
  model: string;
  timeoutMs: number;
  sourceMaxChars: number;
};

export function readQuestRuntimeConfig(env = process.env): QuestRuntimeConfig {
  const provider = env.QUEST_PROVIDER === "openai" ? "openai" : "fixture";
  const liveEnabled = env.QUEST_LIVE_GENERATION_ENABLED === "true";
  const timeoutMs = Number(env.OPENAI_QUEST_TIMEOUT_MS ?? 45000);
  const sourceMaxChars = Number(env.QUEST_SOURCE_MAX_CHARS ?? 20000);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 60000)
    throw new Error("Invalid quest timeout configuration");
  if (
    !Number.isInteger(sourceMaxChars) ||
    sourceMaxChars < 500 ||
    sourceMaxChars > 20000
  )
    throw new Error("Invalid quest source limit configuration");
  if (liveEnabled && !env.OPENAI_API_KEY)
    throw new Error(
      "OPENAI_API_KEY is required when live generation is enabled",
    );
  return {
    provider,
    liveEnabled,
    apiKey: env.OPENAI_API_KEY,
    model: env.OPENAI_QUEST_MODEL ?? "gpt-5.6-sol",
    timeoutMs,
    sourceMaxChars,
  };
}
