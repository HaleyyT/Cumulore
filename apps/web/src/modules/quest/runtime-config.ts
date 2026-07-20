export type QuestRuntimeConfig = {
  provider: "fixture" | "openai";
  liveEnabled: boolean;
  apiKey?: string;
  model: string;
  reasoningEffort: "none" | "low" | "medium" | "high";
  timeoutMs: number;
  sourceMaxChars: number;
  maxOutputTokens: number;
};

export function readQuestRuntimeConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
): QuestRuntimeConfig {
  const providerValue = env.QUEST_PROVIDER ?? "fixture";
  const liveEnabledValue = env.QUEST_LIVE_GENERATION_ENABLED ?? "false";
  if (providerValue !== "fixture" && providerValue !== "openai")
    throw new Error("Invalid quest provider configuration");
  if (liveEnabledValue !== "true" && liveEnabledValue !== "false")
    throw new Error("Invalid live generation configuration");
  const provider = providerValue;
  const liveEnabled = liveEnabledValue === "true";
  const apiKey = env.OPENAI_API_KEY?.trim();
  const model = env.OPENAI_QUEST_MODEL ?? "gpt-5.6-terra";
  const reasoningEffort = env.OPENAI_QUEST_REASONING_EFFORT ?? "low";
  const timeoutMs = Number(env.OPENAI_QUEST_TIMEOUT_MS ?? 45000);
  const sourceMaxChars = Number(env.QUEST_SOURCE_MAX_CHARS ?? 20000);
  const maxOutputTokens = Number(env.QUEST_OUTPUT_MAX_TOKENS ?? 10000);
  if (liveEnabled && provider !== "openai")
    throw new Error(
      "QUEST_PROVIDER=openai is required when live generation is enabled",
    );
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 60000)
    throw new Error("Invalid quest timeout configuration");
  if (
    !Number.isInteger(sourceMaxChars) ||
    sourceMaxChars < 500 ||
    sourceMaxChars > 20000
  )
    throw new Error("Invalid quest source limit configuration");
  if (
    !Number.isInteger(maxOutputTokens) ||
    maxOutputTokens < 4000 ||
    maxOutputTokens > 10000
  )
    throw new Error("Invalid quest output limit configuration");
  if (!/^(gpt-5\.6|gpt-5\.6-(sol|terra|luna))$/.test(model))
    throw new Error("Invalid quest model configuration");
  if (
    !(["none", "low", "medium", "high"] as const).includes(
      reasoningEffort as "none" | "low" | "medium" | "high",
    )
  )
    throw new Error("Invalid quest reasoning configuration");
  if (
    liveEnabled &&
    (!apiKey ||
      apiKey.length < 20 ||
      /your_|replace|placeholder|example|actual[_-]?openai/i.test(apiKey))
  )
    throw new Error(
      "A non-placeholder OPENAI_API_KEY is required when live generation is enabled",
    );
  return {
    provider,
    liveEnabled,
    apiKey,
    model,
    reasoningEffort: reasoningEffort as QuestRuntimeConfig["reasoningEffort"],
    timeoutMs,
    sourceMaxChars,
    maxOutputTokens,
  };
}
