import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  assertLiveEvaluationEnabled,
  parseEvaluationProvider,
} from "../src/modules/quest/evaluation-config.js";
import { scienceQuest } from "../src/modules/quest/fixture.js";
import { OpenAIQuestProvider } from "../src/modules/quest/generation/openai-provider.js";
import { QuestService } from "../src/modules/quest/generation/quest-service.js";
import { readQuestRuntimeConfig } from "../src/modules/quest/runtime-config.js";
import { segmentSource } from "../src/modules/quest/source-segmentation.js";

const sourceFiles = [
  "science-of-learning.txt",
  "http-request-lifecycle.txt",
  "photosynthesis-and-respiration.txt",
];

const provider = parseEvaluationProvider(process.argv.slice(2));

async function readSource(file: string) {
  return readFile(
    new URL(`../test-fixtures/quest/${file}`, import.meta.url),
    "utf8",
  );
}

async function evaluateFixture() {
  for (const file of sourceFiles) {
    const source = await readSource(file);
    assert.ok(
      segmentSource(source).length > 0,
      `${file} has deterministic segments`,
    );
  }

  for (const difficulty of ["easy", "medium", "hard"] as const) {
    const quest = scienceQuest(difficulty);
    assert.equal(quest.concepts.length, 5);
    assert.equal(quest.stages.length, 3);
    assert.equal(quest.rematch.length, 4);
    assert.equal(quest.stages.flatMap((stage) => stage.questions).length, 12);
  }

  console.log(
    "Quest fixture evaluation passed: 3 sources and 3 deterministic difficulties.",
  );
}

async function evaluateLive() {
  assertLiveEvaluationEnabled(process.env);
  const service = new QuestService(
    new OpenAIQuestProvider(readQuestRuntimeConfig(process.env)),
  );
  let successfulCases = 0;

  for (const file of sourceFiles) {
    const sourceText = await readSource(file);
    for (const difficulty of ["easy", "medium", "hard"] as const) {
      const result = await service.generate({
        sourceTitle: file.replace(/\.txt$/, "").replaceAll("-", " "),
        sourceText,
        difficulty,
      });
      assert.equal(
        result.ok,
        true,
        `Live generation must validate for ${file} at ${difficulty}.`,
      );
      successfulCases += 1;
    }
  }

  console.log(
    `Quest live evaluation passed: ${successfulCases}/9 source-difficulty cases validated.`,
  );
}

await (provider === "fixture" ? evaluateFixture() : evaluateLive());
