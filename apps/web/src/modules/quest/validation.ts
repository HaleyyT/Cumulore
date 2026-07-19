import type {
  QuestGeneratedQuestion,
  QuestGenerationV1,
  QuestSourceEvidence,
} from "@cumulore/schemas/quest-generation";

import type { Difficulty, Focus } from "./types";
import type { SourceSegment } from "./source-segmentation";

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
  | {
      ok: false;
      code: QuestValidationCode;
      affectedIds: string[];
      fieldPaths: string[];
    };

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

const orderedFocus: readonly Focus[] = [
  "foundation",
  "connection",
  "synthesis",
];

const normalize = (value: string) =>
  value.toLowerCase().replace(/\s+/g, " ").trim();

function failure(
  code: QuestValidationCode,
  fieldPath: string,
  affectedId?: string,
): QuestValidationResult {
  return {
    ok: false,
    code,
    affectedIds: affectedId ? [affectedId] : [],
    fieldPaths: [fieldPath],
  };
}

export function validateQuestSemantics(
  quest: QuestGenerationV1,
  source: readonly SourceSegment[],
  difficulty: Difficulty,
  sourceTitle: string,
): QuestValidationResult {
  if (
    quest.schemaVersion !== 1 ||
    quest.requestedDifficulty !== difficulty ||
    quest.sourceTitle !== sourceTitle
  )
    return failure("SCHEMA_INVALID", "quest.metadata");

  if (
    !quest.stages.every(
      (stage, index) => stage.cognitiveFocus === orderedFocus[index],
    )
  )
    return failure("DIFFICULTY_RULE_MISMATCH", "stages.cognitiveFocus");

  const identifiers = new Set<string>();
  const prompts = new Set<string>();
  const concepts = new Set<string>();
  const usedConcepts = new Set<string>();
  const segments = new Map(
    source.map((segment) => [segment.id, normalize(segment.text)]),
  );

  const registerId = (id: string, path: string): QuestValidationResult => {
    if (identifiers.has(id)) return failure("IDENTIFIER_DUPLICATE", path, id);
    identifiers.add(id);
    return { ok: true };
  };

  const validateEvidence = (
    evidence: readonly QuestSourceEvidence[],
    path: string,
    affectedId: string,
  ): QuestValidationResult => {
    for (const [index, item] of evidence.entries()) {
      const segment = segments.get(item.segmentId);
      if (!segment)
        return failure(
          "LOCATOR_UNKNOWN",
          `${path}[${index}].segmentId`,
          affectedId,
        );
      if (!segment.includes(normalize(item.excerpt)))
        return failure(
          "EXCERPT_MISMATCH",
          `${path}[${index}].excerpt`,
          affectedId,
        );
    }
    return { ok: true };
  };

  for (const [index, concept] of quest.priorityConcepts.entries()) {
    const path = `priorityConcepts[${index}]`;
    const registered = registerId(concept.conceptId, `${path}.conceptId`);
    if (!registered.ok) return registered;
    concepts.add(concept.conceptId);
    const evidence = validateEvidence(
      concept.evidence,
      `${path}.evidence`,
      concept.conceptId,
    );
    if (!evidence.ok) return evidence;
  }

  const validateReferences = (
    conceptIds: readonly string[],
    path: string,
    affectedId: string,
  ): QuestValidationResult => {
    if (!conceptIds.every((id) => concepts.has(id)))
      return failure("REFERENCE_INVALID", path, affectedId);
    conceptIds.forEach((id) => usedConcepts.add(id));
    return { ok: true };
  };

  const validateQuestion = (
    question: QuestGeneratedQuestion,
    path: string,
    allowedOperations: readonly string[],
  ): QuestValidationResult => {
    const registered = registerId(question.questionId, `${path}.questionId`);
    if (!registered.ok) return registered;

    const references = validateReferences(
      question.conceptIds,
      `${path}.conceptIds`,
      question.questionId,
    );
    if (!references.ok) return references;

    if (!allowedOperations.includes(question.cognitiveOperation))
      return failure(
        "DIFFICULTY_RULE_MISMATCH",
        `${path}.cognitiveOperation`,
        question.questionId,
      );

    const evidence = validateEvidence(
      question.evidence,
      `${path}.evidence`,
      question.questionId,
    );
    if (!evidence.ok) return evidence;

    const optionTexts = question.options.map((option) =>
      normalize(option.text),
    );
    const optionIds = question.options.map((option) => option.optionId);
    const correctOptions = question.options.filter(
      (option) => option.optionId === question.correctOptionId,
    );
    if (
      new Set(optionTexts).size !== 4 ||
      new Set(optionIds).size !== 4 ||
      correctOptions.length !== 1
    )
      return failure("OPTION_INVALID", `${path}.options`, question.questionId);

    for (const [optionIndex, option] of question.options.entries()) {
      const optionId = registerId(
        option.optionId,
        `${path}.options[${optionIndex}].optionId`,
      );
      if (!optionId.ok) return optionId;
    }

    const prompt = normalize(question.prompt);
    if (prompts.has(prompt))
      return failure(
        "CONTENT_DUPLICATE",
        `${path}.prompt`,
        question.questionId,
      );
    prompts.add(prompt);
    return { ok: true };
  };

  for (const [stageIndex, stage] of quest.stages.entries()) {
    const path = `stages[${stageIndex}]`;
    const registered = registerId(stage.stageId, `${path}.stageId`);
    if (!registered.ok) return registered;
    const references = validateReferences(
      stage.conceptIds,
      `${path}.conceptIds`,
      stage.stageId,
    );
    if (!references.ok) return references;
    for (const [questionIndex, question] of stage.questions.entries()) {
      const result = validateQuestion(
        question,
        `${path}.questions[${questionIndex}]`,
        operations[difficulty][stage.cognitiveFocus],
      );
      if (!result.ok) return result;
    }
  }

  const rematchOperations = Object.values(operations[difficulty]).flat();
  for (const [index, question] of quest.rematchQuestions.entries()) {
    const result = validateQuestion(
      question,
      `rematchQuestions[${index}]`,
      rematchOperations,
    );
    if (!result.ok) return result;
  }

  for (const [index, takeaway] of quest.reviewTakeaways.entries()) {
    const path = `reviewTakeaways[${index}]`;
    const registered = registerId(takeaway.takeawayId, `${path}.takeawayId`);
    if (!registered.ok) return registered;
    const references = validateReferences(
      takeaway.conceptIds,
      `${path}.conceptIds`,
      takeaway.takeawayId,
    );
    if (!references.ok) return references;
    const evidence = validateEvidence(
      takeaway.evidence,
      `${path}.evidence`,
      takeaway.takeawayId,
    );
    if (!evidence.ok) return evidence;
  }

  if (![...concepts].every((conceptId) => usedConcepts.has(conceptId)))
    return failure("REFERENCE_INVALID", "priorityConcepts");

  return { ok: true };
}
