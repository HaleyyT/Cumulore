import {
  isQuestGenerationV1,
  type QuestGenerationV1,
} from "@cumulore/schemas/quest-generation";

import { segmentSource } from "../source-segmentation";
import { validateQuestSemantics } from "../validation";
import type { Difficulty } from "../types";
import type { QuestGenerationInput, QuestProvider } from "./provider";

export type QuestServiceResult =
  | { ok: true; quest: QuestGenerationV1 }
  | { ok: false; code: "GENERATION_INVALID" };

export type QuestServiceInput = Omit<QuestGenerationInput, "sourceSegments"> & {
  sourceText: string;
  difficulty: Difficulty;
};

export class QuestService {
  constructor(private readonly provider: QuestProvider) {}

  async generate(input: QuestServiceInput): Promise<QuestServiceResult> {
    const sourceSegments = segmentSource(input.sourceText);
    const providerInput: QuestGenerationInput = {
      sourceTitle: input.sourceTitle,
      sourceSegments,
      difficulty: input.difficulty,
      learningGoal: input.learningGoal,
    };
    const validate = (quest: unknown) => {
      if (!isQuestGenerationV1(quest))
        return {
          ok: false as const,
          code: "SCHEMA_INVALID" as const,
          affectedIds: [],
          fieldPaths: ["quest"],
        };
      const semantics = validateQuestSemantics(
        quest,
        sourceSegments,
        input.difficulty,
        input.sourceTitle,
      );
      return semantics.ok ? ({ ok: true as const, quest } as const) : semantics;
    };

    const quest = await this.provider.generate(providerInput);
    const validation = validate(quest);
    if (validation.ok) return { ok: true, quest: validation.quest };
    if (!this.provider.repair) return { ok: false, code: "GENERATION_INVALID" };
    const repaired = await this.provider.repair({
      ...providerInput,
      repair: {
        validationCode: validation.code,
        affectedIds: validation.affectedIds,
        fieldPaths: validation.fieldPaths,
      },
    });
    const repairedValidation = validate(repaired);
    return repairedValidation.ok
      ? { ok: true, quest: repairedValidation.quest }
      : { ok: false, code: "GENERATION_INVALID" };
  }
}
