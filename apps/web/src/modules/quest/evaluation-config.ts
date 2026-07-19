export type EvaluationProvider = "fixture" | "live";

type EvaluationEnvironment = Readonly<Record<string, string | undefined>>;

export function parseEvaluationProvider(
  args: readonly string[],
): EvaluationProvider {
  const provider = args.find((argument) => argument.startsWith("--provider="));

  if (provider === "--provider=fixture") return "fixture";
  if (provider === "--provider=live") return "live";

  throw new Error(
    "Choose an evaluation provider explicitly: --provider=fixture or --provider=live.",
  );
}

export function assertLiveEvaluationEnabled(env: EvaluationEnvironment): void {
  if (env.QUEST_PROVIDER !== "openai") {
    throw new Error("Live evaluation requires QUEST_PROVIDER=openai.");
  }
  if (env.QUEST_LIVE_GENERATION_ENABLED !== "true") {
    throw new Error(
      "Live evaluation requires QUEST_LIVE_GENERATION_ENABLED=true.",
    );
  }
  if (!env.OPENAI_API_KEY) {
    throw new Error("Live evaluation requires OPENAI_API_KEY.");
  }
}
