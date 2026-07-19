import type { Difficulty, Focus, Question, Quest } from "./types";

const excerpt =
  "Retrieval practice, spacing, interleaving, feedback, and transfer strengthen durable learning.";

function question(
  id: string,
  conceptId: string,
  prompt: string,
  correct: string,
  distractors: readonly string[],
): Question {
  return {
    id,
    conceptIds: [conceptId],
    prompt,
    correctId: `${id}-a`,
    options: [
      { id: `${id}-a`, text: correct },
      ...distractors.map((text, index) => ({ id: `${id}-${index + 1}`, text })),
    ],
    explanation: `${correct} is supported by the supplied learning-science material.`,
    excerpt,
  };
}

const questions = [
  question(
    "question-retrieval",
    "concept-retrieval",
    "Which practice strengthens recall?",
    "Retrieval practice",
    ["Rereading only", "Highlighting only", "Avoiding mistakes"],
  ),
  question(
    "question-spacing",
    "concept-spacing",
    "What does spacing change?",
    "It distributes practice over time",
    [
      "It removes practice",
      "It makes one session longer",
      "It avoids feedback",
    ],
  ),
  question(
    "question-interleaving",
    "concept-interleaving",
    "What is interleaving?",
    "Mixing related problem types",
    ["Repeating one type only", "Skipping practice", "Memorizing answers"],
  ),
  question(
    "question-feedback",
    "concept-feedback",
    "Why use feedback?",
    "It corrects misconceptions",
    ["It replaces practice", "It guarantees memory", "It removes effort"],
  ),
] as const;

function stage(focus: Focus, index: number) {
  return {
    id: `stage-${focus}`,
    focus,
    misconception: "Make it easy - Turn friction into fluency.",
    questions: questions.map((base) => ({
      ...base,
      id: `${base.id}-${index}`,
      correctId: `${base.id}-${index}-a`,
      options: base.options.map((option) => ({
        ...option,
        id: option.id.replace(base.id, `${base.id}-${index}`),
      })),
    })),
  };
}

export function scienceQuest(difficulty: Difficulty): Quest {
  return {
    title: "Science of Learning",
    difficulty,
    concepts: [
      {
        id: "concept-retrieval",
        title: "Retrieval practice",
        reason: "Makes recall effortful",
      },
      {
        id: "concept-spacing",
        title: "Spacing",
        reason: "Distributes practice",
      },
      {
        id: "concept-interleaving",
        title: "Interleaving",
        reason: "Builds discrimination",
      },
      { id: "concept-feedback", title: "Feedback", reason: "Corrects errors" },
      { id: "concept-transfer", title: "Transfer", reason: "Applies learning" },
    ],
    stages: [
      stage("foundation", 0),
      stage("connection", 1),
      stage("synthesis", 2),
    ],
    rematch: questions,
    takeaways: [
      {
        id: "takeaway-retrieval",
        conceptIds: ["concept-retrieval"],
        text: "Practise retrieving an idea before rereading it.",
        excerpts: [excerpt],
      },
      {
        id: "takeaway-spacing",
        conceptIds: ["concept-spacing"],
        text: "Spread short practice sessions across time.",
        excerpts: [excerpt],
      },
      {
        id: "takeaway-feedback",
        conceptIds: ["concept-feedback"],
        text: "Use feedback to find and correct misconceptions.",
        excerpts: [excerpt],
      },
    ],
  };
}
