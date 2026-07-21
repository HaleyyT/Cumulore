import type { Option, Question } from "./types";

function hash(value: string): number {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

function nextRandom(seed: number): number {
  return (Math.imul(seed, 1664525) + 1013904223) >>> 0;
}

/**
 * The order is stable during one run, while a new run seed produces an
 * independent presentation order. The quest itself remains immutable.
 */
export function orderQuestionOptions(
  question: Question,
  runSeed: number,
): readonly Option[] {
  const options = [...question.options];
  let seed = hash(`${runSeed}:${question.id}`);

  for (let index = options.length - 1; index > 0; index -= 1) {
    seed = nextRandom(seed);
    const swapIndex = seed % (index + 1);
    [options[index], options[swapIndex]] = [
      options[swapIndex]!,
      options[index]!,
    ];
  }

  return options;
}
