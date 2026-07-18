export type Difficulty = "easy" | "medium" | "hard";
export type Focus = "foundation" | "connection" | "synthesis";
export type PriorityBand = "critical" | "high" | "medium" | "low" | "baseline";

export type Option = { id: string; text: string };
export type Question = {
  id: string;
  conceptIds: readonly string[];
  prompt: string;
  options: readonly Option[];
  correctId: string;
  explanation: string;
  excerpt: string;
};
export type Stage = {
  id: string;
  focus: Focus;
  misconception: string;
  questions: readonly Question[];
};
export type Quest = {
  title: string;
  difficulty: Difficulty;
  concepts: readonly { id: string; title: string; reason: string }[];
  stages: readonly Stage[];
  rematch: readonly Question[];
};

export type Battle = {
  stage: number;
  question: number;
  health: number;
  hearts: number;
  streak: number;
  score: number;
  answered: Readonly<Record<string, boolean>>;
  selected?: string;
  feedback?: boolean;
  stageFailed?: boolean;
};
