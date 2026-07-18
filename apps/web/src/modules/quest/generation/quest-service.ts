import { segmentSource } from "../source-segmentation";
import { validateQuestSemantics } from "../validation";
import type { Difficulty } from "../types";
import type { QuestProvider } from "./provider";

export type QuestServiceResult =
  | { ok: true; quest: unknown }
  | { ok: false; code: "GENERATION_INVALID" };

export class QuestService {
  constructor(private readonly provider: QuestProvider) {}

  async generate(input: {
    sourceTitle: string;
    sourceText: string;
    difficulty: Difficulty;
  }): Promise<QuestServiceResult> {
    const quest = await this.provider.generate(input);
    const validation = validateQuestSemantics(
      quest as never,
      segmentSource(input.sourceText),
      input.difficulty,
    );
    return validation.ok
      ? { ok: true, quest }
      : { ok: false, code: "GENERATION_INVALID" };
  }
}
