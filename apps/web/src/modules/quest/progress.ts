import type { Battle, Stage } from "./types";

export function calculateStageProgress(stage: Stage, battle: Battle): number {
  const answered = stage.questions.filter(
    (question) => battle.answered[question.id] !== undefined,
  ).length;
  const stageCompleted =
    battle.health === 0 || answered === stage.questions.length;

  if (stageCompleted) return 100;
  return Math.round((answered / Math.max(stage.questions.length, 1)) * 100);
}
