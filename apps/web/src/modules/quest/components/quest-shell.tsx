"use client";

import { useReducer } from "react";

import { scienceQuest } from "../fixture";
import {
  answer,
  continueQuest,
  initialBattle,
  next,
  retryStage,
} from "../reducer";
import type { Battle, Difficulty } from "../types";

type BattleAction =
  | { type: "answer"; optionId: string }
  | { type: "next" }
  | { type: "retry" }
  | { type: "continue" };

function battleReducer(quest: ReturnType<typeof scienceQuest>) {
  return (state: Battle, action: BattleAction): Battle => {
    switch (action.type) {
      case "answer":
        return answer(quest, state, action.optionId);
      case "next":
        return next(quest, state);
      case "retry":
        return retryStage(state);
      case "continue":
        return continueQuest(quest, state);
    }
  };
}

export function QuestShell() {
  const [difficulty, setDifficulty] = useReducer(
    (_: Difficulty, nextDifficulty: Difficulty) => nextDifficulty,
    "medium",
  );
  const quest = scienceQuest(difficulty);
  const [battle, dispatch] = useReducer(
    battleReducer(quest),
    undefined,
    initialBattle,
  );
  const stage = quest.stages[battle.stage];

  if (!stage)
    return (
      <main className="quest-shell">
        <p className="mode-badge">Deterministic Demo</p>
        <h1>Cumulore Quest complete</h1>
        <p>You finished the Science of Learning practice quest.</p>
        <p className="score">Final score: {battle.score}</p>
        <button type="button" onClick={() => window.location.reload()}>
          Play again
        </button>
      </main>
    );

  const question = stage.questions[battle.question];
  const canContinue =
    !battle.feedback && !battle.stageFailed && battle.health === 0;

  return (
    <main className="quest-shell">
      <header className="quest-header">
        <p className="mode-badge">Deterministic Demo</p>
        <h1>Cumulore Quest</h1>
        <p>A source-grounded boss battle about the Science of Learning.</p>
        <label htmlFor="difficulty">
          Difficulty
          <select
            id="difficulty"
            value={difficulty}
            disabled={battle.question > 0 || battle.stage > 0}
            onChange={(event) =>
              setDifficulty(event.target.value as Difficulty)
            }
          >
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </label>
      </header>

      <section aria-labelledby="priority-focus">
        <h2 id="priority-focus">Priority Focus</h2>
        <ol>
          {quest.concepts.map((concept) => (
            <li key={concept.id}>
              <strong>{concept.title}</strong> — {concept.reason}
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="battle-heading">
        <h2 id="battle-heading">
          {stage.focus}: {stage.misconception}
        </h2>
        <p aria-live="polite" className="battle-status">
          Enemy health: {battle.health}/100. Hearts: {battle.hearts}. Score:{" "}
          {battle.score}.
        </p>

        {battle.stageFailed ? (
          <div className="stage-result" role="status">
            <h3>Stage needs another try</h3>
            <p>
              The enemy still has health. Retrying restores this stage’s fixed
              questions and hearts.
            </p>
            <button type="button" onClick={() => dispatch({ type: "retry" })}>
              Retry stage
            </button>
          </div>
        ) : canContinue ? (
          <div className="stage-result" role="status">
            <h3>Stage cleared</h3>
            <p>The next stage keeps the same selected difficulty.</p>
            <button
              type="button"
              onClick={() => dispatch({ type: "continue" })}
            >
              Continue quest
            </button>
          </div>
        ) : question ? (
          <div className="answer-panel">
            <h3>{question.prompt}</h3>
            <div aria-label="Answer options" className="answer-options">
              {question.options.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  disabled={Boolean(battle.feedback)}
                  onClick={() =>
                    dispatch({ type: "answer", optionId: option.id })
                  }
                >
                  {option.text}
                </button>
              ))}
            </div>
            {battle.feedback ? (
              <aside className="evidence-card" tabIndex={-1} aria-live="polite">
                <p>
                  {battle.selected === question.correctId
                    ? "Correct."
                    : "Not quite."}{" "}
                  {question.explanation}
                </p>
                <blockquote>{question.excerpt}</blockquote>
                <button
                  type="button"
                  onClick={() => dispatch({ type: "next" })}
                >
                  Continue
                </button>
              </aside>
            ) : null}
          </div>
        ) : null}
      </section>
    </main>
  );
}
