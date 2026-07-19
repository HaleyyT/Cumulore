import type { Difficulty, Focus } from "./types";
import type { SourceSegment } from "./source-segmentation";

type Evidence = { segmentId: string; excerpt: string };
type GeneratedQuestion = {
  questionId: string;
  conceptIds: string[];
  cognitiveOperation: string;
  prompt: string;
  options: { optionId: string; text: string }[];
  correctOptionId: string;
  evidence: Evidence[];
};
type GeneratedQuest = {
  schemaVersion: number;
  requestedDifficulty: string;
  sourceTitle: string;
  priorityConcepts: { conceptId: string }[];
  stages: {
    stageId: string;
    cognitiveFocus: string;
    conceptIds: string[];
    questions: GeneratedQuestion[];
  }[];
  rematchQuestions: GeneratedQuestion[];
  reviewTakeaways: {
    takeawayId: string;
    conceptIds: string[];
    evidence: Evidence[];
  }[];
};

export type QuestValidationCode =
  | "SCHEMA_INVALID"
  | "LOCATOR_UNKNOWN"
  | "EXCERPT_MISMATCH"
  | "OPTION_INVALID"
  | "REFERENCE_INVALID"
  | "IDENTIFIER_DUPLICATE"
  | "CONTENT_DUPLICATE"
  | "DIFFICULTY_RULE_MISMATCH";
export type QuestValidationResult =
  | { ok: true }
  | { ok: false; code: QuestValidationCode };

const operations: Record<Difficulty, Record<Focus, readonly string[]>> = {
  easy: {
    foundation: ["recognize", "recall"],
    connection: ["relate", "sequence"],
    synthesis: ["apply_familiar"],
  },
  medium: {
    foundation: ["explain", "differentiate"],
    connection: ["cause_effect", "combine"],
    synthesis: ["apply_multistep", "infer"],
  },
  hard: {
    foundation: ["discriminate", "qualify"],
    connection: ["integrate", "diagnose"],
    synthesis: ["transfer", "evaluate"],
  },
};
const normalize = (value: string) =>
  value.toLowerCase().replace(/\s+/g, " ").trim();

export function validateQuestSemantics(
  quest: GeneratedQuest,
  source: readonly SourceSegment[],
  difficulty: Difficulty,
  sourceTitle: string,
): QuestValidationResult {
  if (
    quest.schemaVersion !== 1 ||
    quest.requestedDifficulty !== difficulty ||
    quest.sourceTitle !== sourceTitle
  )
    return { ok: false, code: "SCHEMA_INVALID" };
  const concepts = new Set(
    quest.priorityConcepts.map((concept) => concept.conceptId),
  );
  const ids = new Set<string>();
  const prompts = new Set<string>();
  const segments = new Map(
    source.map((segment) => [segment.id, normalize(segment.text)]),
  );
  const evidenceIsValid = (evidence: readonly Evidence[]) =>
    evidence.every((item) => {
      const segment = segments.get(item.segmentId);
      return segment ? segment.includes(normalize(item.excerpt)) : false;
    });
  const validateQuestion = (
    question: GeneratedQuestion,
    focus?: Focus,
  ): QuestValidationResult => {
    if (ids.has(question.questionId))
      return { ok: false, code: "IDENTIFIER_DUPLICATE" };
    ids.add(question.questionId);
    if (!question.conceptIds.every((id) => concepts.has(id)))
      return { ok: false, code: "REFERENCE_INVALID" };
    if (!evidenceIsValid(question.evidence))
      return { ok: false, code: "EXCERPT_MISMATCH" };
    if (
      focus &&
      !operations[difficulty][focus].includes(question.cognitiveOperation)
    )
      return { ok: false, code: "DIFFICULTY_RULE_MISMATCH" };
    const optionText = question.options.map((option) => normalize(option.text));
    if (
      new Set(optionText).size !== 4 ||
      !question.options.some(
        (option) => option.optionId === question.correctOptionId,
      )
    )
      return { ok: false, code: "OPTION_INVALID" };
    const prompt = normalize(question.prompt);
    if (prompts.has(prompt)) return { ok: false, code: "CONTENT_DUPLICATE" };
    prompts.add(prompt);
    return { ok: true };
  };
  for (const stage of quest.stages) {
    if (!stage.conceptIds.every((id) => concepts.has(id)))
      return { ok: false, code: "REFERENCE_INVALID" };
    if (
      !(["foundation", "connection", "synthesis"] as const).includes(
        stage.cognitiveFocus as Focus,
      )
    )
      return { ok: false, code: "DIFFICULTY_RULE_MISMATCH" };
    for (const question of stage.questions) {
      const result = validateQuestion(question, stage.cognitiveFocus as Focus);
      if (!result.ok) return result;
    }
  }
  for (const question of quest.rematchQuestions) {
    const result = validateQuestion(question);
    if (!result.ok) return result;
  }
  for (const takeaway of quest.reviewTakeaways)
    if (
      !takeaway.conceptIds.every((id) => concepts.has(id)) ||
      !evidenceIsValid(takeaway.evidence)
    )
      return { ok: false, code: "REFERENCE_INVALID" };
  return { ok: true };
}
