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
    const validate = (quest: unknown) =>
      validateQuestSemantics(
        quest as never,
        segmentSource(input.sourceText),
        input.difficulty,
        input.sourceTitle,
      );
    const quest = await this.provider.generate(input);
    const validation = validate(quest);
    if (validation.ok) return { ok: true, quest };
    if (!this.provider.repair) return { ok: false, code: "GENERATION_INVALID" };
    const repaired = await this.provider.repair({
      ...input,
      validationCode: validation.code,
    });
    return validate(repaired).ok
      ? { ok: true, quest: repaired }
      : { ok: false, code: "GENERATION_INVALID" };
  }
}
