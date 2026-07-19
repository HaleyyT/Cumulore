import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import questGenerationSchema from "../contracts/quest-generation.v1.schema.json" with { type: "json" };

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateQuest = ajv.compile(questGenerationSchema);

export type QuestDifficulty = "easy" | "medium" | "hard";
export type QuestCognitiveFocus = "foundation" | "connection" | "synthesis";
export type QuestCognitiveOperation =
  | "recognize"
  | "recall"
  | "relate"
  | "sequence"
  | "apply_familiar"
  | "explain"
  | "differentiate"
  | "cause_effect"
  | "combine"
  | "apply_multistep"
  | "infer"
  | "discriminate"
  | "qualify"
  | "integrate"
  | "diagnose"
  | "transfer"
  | "evaluate";

export type QuestSourceEvidence = {
  segmentId: string;
  excerpt: string;
};

export type QuestGeneratedOption = {
  optionId: string;
  text: string;
};

export type QuestGeneratedQuestion = {
  questionId: string;
  conceptIds: string[];
  cognitiveOperation: QuestCognitiveOperation;
  prompt: string;
  options: QuestGeneratedOption[];
  correctOptionId: string;
  answerExplanation: string;
  evidence: QuestSourceEvidence[];
};

export type QuestGeneratedConcept = {
  conceptId: string;
  title: string;
  learningObjective: string;
  priorityReason: string;
  evidence: QuestSourceEvidence[];
};

export type QuestGeneratedStage = {
  stageId: string;
  cognitiveFocus: QuestCognitiveFocus;
  educationalMisconception: string;
  conceptIds: string[];
  questions: QuestGeneratedQuestion[];
};

export type QuestGeneratedTakeaway = {
  takeawayId: string;
  text: string;
  conceptIds: string[];
  evidence: QuestSourceEvidence[];
};

export type QuestGenerationV1 = {
  schemaVersion: 1;
  requestedDifficulty: QuestDifficulty;
  sourceTitle: string;
  priorityConcepts: QuestGeneratedConcept[];
  stages: QuestGeneratedStage[];
  rematchQuestions: QuestGeneratedQuestion[];
  reviewTakeaways: QuestGeneratedTakeaway[];
};

export function isQuestGenerationV1(
  value: unknown,
): value is QuestGenerationV1 {
  return validateQuest(value) as boolean;
}

export function parseQuestGenerationV1(value: unknown): QuestGenerationV1 {
  if (isQuestGenerationV1(value)) return value;
  throw new Error(
    `Quest generation v1 is invalid: ${ajv.errorsText(validateQuest.errors)}`,
  );
}
