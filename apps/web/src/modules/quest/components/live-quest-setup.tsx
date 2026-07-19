"use client";

import { useRef, useState } from "react";
import { QuestSubmissionGate } from "../generation/submission-gate";
import { toRuntimeQuest } from "../live-quest";
import type { Difficulty, Quest } from "../types";

type LiveQuestResponse = { error?: { message?: string }; quest?: unknown };

export function LiveQuestSetup({
  difficulty,
  onQuestReady,
}: {
  difficulty: Difficulty;
  onQuestReady: (quest: Quest) => void;
}) {
  const gate = useRef(new QuestSubmissionGate<LiveQuestResponse>());
  const [message, setMessage] = useState<string>();

  async function submit(form: HTMLFormElement) {
    setMessage(undefined);
    try {
      const result = await gate.current.submit(
        async () => {
          const data = new FormData(form);
          data.set("requestId", crypto.randomUUID());
          data.set("mode", "live");
          data.set("requestedDifficulty", difficulty);
          const response = await fetch("/api/quest/generate", {
            method: "POST",
            body: data,
          });
          return (await response.json()) as LiveQuestResponse;
        },
        (result) => !result.error && toRuntimeQuest(result.quest) !== undefined,
      );
      if (result.error) {
        setMessage(result.error.message ?? "Live generation is unavailable.");
        return;
      }
      const quest = toRuntimeQuest(result.quest);
      if (!quest) {
        setMessage(
          "Live generation returned an invalid quest. Try again or use Deterministic Demo.",
        );
        return;
      }
      onQuestReady(quest);
      setMessage("Your live quest is ready.");
    } catch {
      setMessage(
        "This request has already completed. Start a new setup to try again.",
      );
    }
  }

  return (
    <details className="live-setup">
      <summary>Try Live AI with your own material</summary>
      <p>
        Live AI sends the material you provide to OpenAI to generate your quest.
        Cumulore Quest does not persist it in this hackathon build. Choose
        Deterministic Demo if you do not want to send material.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit(event.currentTarget);
        }}
      >
        <label>
          Source title
          <input name="sourceTitle" maxLength={120} required />
        </label>
        <label>
          Source text
          <textarea
            name="sourceText"
            minLength={500}
            maxLength={20000}
            required
          />
        </label>
        <label className="consent">
          <input name="consent" type="checkbox" value="true" required /> I
          understand this material will be sent to OpenAI.
        </label>
        <button className="button button-light" type="submit">
          Generate live quest <span aria-hidden="true">↗</span>
        </button>
      </form>
      {message ? <p role="status">{message}</p> : null}
    </details>
  );
}
