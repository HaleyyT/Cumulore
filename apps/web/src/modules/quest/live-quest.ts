import type {
  Difficulty,
  Focus,
  Question,
  Quest,
  Stage,
  Takeaway,
} from "./types";

type UnknownRecord = Record<string, unknown>;

const difficulties = new Set<Difficulty>(["easy", "medium", "hard"]);
const focuses = new Set<Focus>(["foundation", "connection", "synthesis"]);

function record(value: unknown): UnknownRecord | undefined {
  return typeof value === "object" && value !== null
    ? (value as UnknownRecord)
    : undefined;
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function textList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const values = value.map(text);
  return values.every((item): item is string => item !== undefined)
    ? values
    : undefined;
}

function toQuestion(value: unknown): Question | undefined {
  const item = record(value);
  const id = text(item?.questionId);
  const conceptIds = textList(item?.conceptIds);
  const prompt = text(item?.prompt);
  const correctId = text(item?.correctOptionId);
  const explanation = text(item?.answerExplanation);
  const evidence = Array.isArray(item?.evidence)
    ? record(item.evidence[0])
    : undefined;
  const excerpt = text(evidence?.excerpt);
  if (
    !id ||
    !conceptIds ||
    !prompt ||
    !correctId ||
    !explanation ||
    !excerpt ||
    !Array.isArray(item?.options)
  )
    return undefined;

  const options = item.options.map((option) => {
    const candidate = record(option);
    const optionId = text(candidate?.optionId);
    const optionText = text(candidate?.text);
    return optionId && optionText
      ? { id: optionId, text: optionText }
      : undefined;
  });
  if (
    options.length !== 4 ||
    !options.every(
      (option): option is { id: string; text: string } => option !== undefined,
    ) ||
    !options.some((option) => option.id === correctId)
  )
    return undefined;

  return { id, conceptIds, prompt, options, correctId, explanation, excerpt };
}

function toStage(value: unknown): Stage | undefined {
  const item = record(value);
  const id = text(item?.stageId);
  const focus = text(item?.cognitiveFocus);
  const misconception = text(item?.educationalMisconception);
  if (
    !id ||
    !focuses.has(focus as Focus) ||
    !misconception ||
    !Array.isArray(item?.questions)
  )
    return undefined;
  const questions = item.questions.map(toQuestion);
  if (
    questions.length !== 4 ||
    !questions.every((question): question is Question => question !== undefined)
  )
    return undefined;
  return { id, focus: focus as Focus, misconception, questions };
}

function toTakeaway(value: unknown): Takeaway | undefined {
  const item = record(value);
  const id = text(item?.takeawayId);
  const takeawayText = text(item?.text);
  const conceptIds = textList(item?.conceptIds);
  if (!id || !takeawayText || !conceptIds || !Array.isArray(item?.evidence))
    return undefined;
  const excerpts = item.evidence.map((evidence) =>
    text(record(evidence)?.excerpt),
  );
  if (
    excerpts.length < 1 ||
    excerpts.length > 2 ||
    !excerpts.every((excerpt): excerpt is string => excerpt !== undefined)
  )
    return undefined;
  return { id, text: takeawayText, conceptIds, excerpts };
}

/**
 * Maps only validated educational fields into the combat runtime. Runtime
 * mechanics remain application-owned and cannot arrive in a provider response.
 */
export function toRuntimeQuest(value: unknown): Quest | undefined {
  const item = record(value);
  const title = text(item?.sourceTitle);
  const difficulty = text(item?.requestedDifficulty);
  if (!title || !difficulty || !difficulties.has(difficulty as Difficulty))
    return undefined;

  if (!Array.isArray(item?.priorityConcepts) || !Array.isArray(item.stages))
    return undefined;
  const concepts = item.priorityConcepts.map((concept) => {
    const candidate = record(concept);
    const id = text(candidate?.conceptId);
    const conceptTitle = text(candidate?.title);
    const reason = text(candidate?.priorityReason);
    return id && conceptTitle && reason
      ? { id, title: conceptTitle, reason }
      : undefined;
  });
  const stages = item.stages.map(toStage);
  const rematch = Array.isArray(item.rematchQuestions)
    ? item.rematchQuestions.map(toQuestion)
    : [];
  const takeaways = Array.isArray(item.reviewTakeaways)
    ? item.reviewTakeaways.map(toTakeaway)
    : [];
  if (
    concepts.length !== 5 ||
    !concepts.every(
      (concept): concept is { id: string; title: string; reason: string } =>
        concept !== undefined,
    ) ||
    stages.length !== 3 ||
    !stages.every((stage): stage is Stage => stage !== undefined) ||
    rematch.length !== 4 ||
    !rematch.every(
      (question): question is Question => question !== undefined,
    ) ||
    takeaways.length !== 3 ||
    !takeaways.every((takeaway): takeaway is Takeaway => takeaway !== undefined)
  )
    return undefined;

  return {
    title,
    difficulty: difficulty as Difficulty,
    concepts,
    stages,
    rematch,
    takeaways,
  };
}
