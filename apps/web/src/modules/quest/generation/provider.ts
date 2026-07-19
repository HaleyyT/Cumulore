import type { SourceSegment } from "../source-segmentation";

export type QuestGenerationInput = {
  sourceTitle: string;
  sourceSegments: readonly SourceSegment[];
  difficulty: "easy" | "medium" | "hard";
  learningGoal?: string;
};

export type QuestRepairDetails = {
  validationCode: string;
  affectedIds: readonly string[];
  fieldPaths: readonly string[];
};

export type QuestRepairInput = QuestGenerationInput & {
  repair: QuestRepairDetails;
};

export interface QuestProvider {
  generate(input: QuestGenerationInput): Promise<unknown>;
  repair?(input: QuestRepairInput): Promise<unknown>;
}
