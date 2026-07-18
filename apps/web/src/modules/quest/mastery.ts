import type { Question, Quest } from "./types";

export type ConceptMastery = {
  conceptId: string;
  correct: number;
  answered: number;
  wrong: number;
  mastery: number | undefined;
};

export function calculateMastery(
  quest: Quest,
  answered: Readonly<Record<string, boolean>>,
): ConceptMastery[] {
  return quest.concepts.map((concept) => {
    const questions = quest.stages
      .flatMap((stage) => stage.questions)
      .filter((question) => question.conceptIds.includes(concept.id));
    const answeredQuestions = questions.filter(
      (question) => answered[question.id] !== undefined,
    );
    const correct = answeredQuestions.filter(
      (question) => answered[question.id],
    ).length;
    return {
      conceptId: concept.id,
      correct,
      answered: answeredQuestions.length,
      wrong: answeredQuestions.length - correct,
      mastery: answeredQuestions.length
        ? correct / answeredQuestions.length
        : undefined,
    };
  });
}

export function orderRematch(
  quest: Quest,
  mastery: readonly ConceptMastery[],
): Question[] {
  const byConcept = new Map(
    mastery.map((item, index) => [item.conceptId, { ...item, index }]),
  );
  return [...quest.rematch].sort((left, right) => {
    const a = byConcept.get(left.conceptIds[0]!);
    const b = byConcept.get(right.conceptIds[0]!);
    const aMastery = a?.mastery ?? Number.POSITIVE_INFINITY;
    const bMastery = b?.mastery ?? Number.POSITIVE_INFINITY;
    return (
      aMastery - bMastery ||
      (b?.wrong ?? 0) - (a?.wrong ?? 0) ||
      (a?.index ?? 99) - (b?.index ?? 99) ||
      left.id.localeCompare(right.id)
    );
  });
}
