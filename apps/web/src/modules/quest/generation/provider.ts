export interface QuestProvider {
  generate(input: {
    sourceTitle: string;
    sourceText: string;
    difficulty: "easy" | "medium" | "hard";
  }): Promise<unknown>;
}
