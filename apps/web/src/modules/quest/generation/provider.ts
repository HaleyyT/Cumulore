export type QuestGenerationInput = {
  sourceTitle: string;
  sourceText: string;
  difficulty: "easy" | "medium" | "hard";
  learningGoal?: string;
};

export interface QuestProvider {
  generate(input: QuestGenerationInput): Promise<unknown>;
  repair?(
    input: QuestGenerationInput & { validationCode: string },
  ): Promise<unknown>;
}
