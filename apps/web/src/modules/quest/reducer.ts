import type { Battle, Quest } from "./types";

export const QUEST_COMBAT = {
  enemyMaxHealth: 100,
  baseCorrectDamage: 34,
  secondConsecutiveBonus: 5,
  thirdAndLaterConsecutiveBonus: 10,
  startingHearts: 5,
  correctScore: 100,
  secondStreakScoreBonus: 25,
  thirdAndLaterStreakScoreBonus: 50,
} as const;

export const initialBattle = (): Battle => ({
  stage: 0,
  question: 0,
  health: QUEST_COMBAT.enemyMaxHealth,
  hearts: QUEST_COMBAT.startingHearts,
  streak: 0,
  score: 0,
  answered: {},
});

function bonusForStreak(streak: number, second: number, third: number): number {
  if (streak === 2) return second;
  return streak >= 3 ? third : 0;
}

export function answer(quest: Quest, battle: Battle, optionId: string): Battle {
  const question = quest.stages[battle.stage]?.questions[battle.question];
  if (
    !question ||
    battle.feedback ||
    battle.answered[question.id] !== undefined
  )
    return battle;

  const correct = optionId === question.correctId;
  const streak = correct ? battle.streak + 1 : 0;
  const damage = correct
    ? QUEST_COMBAT.baseCorrectDamage +
      bonusForStreak(
        streak,
        QUEST_COMBAT.secondConsecutiveBonus,
        QUEST_COMBAT.thirdAndLaterConsecutiveBonus,
      )
    : 0;
  const score = correct
    ? QUEST_COMBAT.correctScore +
      bonusForStreak(
        streak,
        QUEST_COMBAT.secondStreakScoreBonus,
        QUEST_COMBAT.thirdAndLaterStreakScoreBonus,
      )
    : 0;

  return {
    ...battle,
    selected: optionId,
    feedback: true,
    streak,
    health: Math.max(0, battle.health - damage),
    hearts: correct ? battle.hearts : Math.max(0, battle.hearts - 1),
    score: battle.score + score,
    answered: { ...battle.answered, [question.id]: correct },
  };
}

export function next(quest: Quest, battle: Battle): Battle {
  if (!battle.feedback) return battle;
  const stageFinished =
    battle.health === 0 ||
    battle.hearts === 0 ||
    battle.question === (quest.stages[battle.stage]?.questions.length ?? 1) - 1;
  if (!stageFinished)
    return {
      ...battle,
      question: battle.question + 1,
      selected: undefined,
      feedback: false,
    };

  const failed = battle.health > 0;
  return { ...battle, feedback: false, stageFailed: failed };
}

export function retryStage(battle: Battle): Battle {
  if (!battle.stageFailed) return battle;
  return { ...initialBattle(), stage: battle.stage, score: battle.score };
}

export function continueQuest(quest: Quest, battle: Battle): Battle {
  if (battle.stageFailed || battle.health > 0) return battle;
  return { ...initialBattle(), stage: battle.stage + 1, score: battle.score };
}
