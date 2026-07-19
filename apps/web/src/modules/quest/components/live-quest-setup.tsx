"use client";

import { useRef, useState } from "react";
import { QuestSubmissionGate } from "../generation/submission-gate";
import type { Difficulty } from "../types";

export function LiveQuestSetup({ difficulty }: { difficulty: Difficulty }) {
  const gate = useRef(
    new QuestSubmissionGate<{ error?: { message?: string } }>(),
  );
  const [message, setMessage] = useState<string>();

  async function submit(form: HTMLFormElement) {
    setMessage(undefined);
    try {
      const result = await gate.current.submit(async () => {
        const data = new FormData(form);
        data.set("requestId", crypto.randomUUID());
        data.set("mode", "live");
        data.set("requestedDifficulty", difficulty);
        const response = await fetch("/api/quest/generate", {
          method: "POST",
          body: data,
        });
        return (await response.json()) as { error?: { message?: string } };
      });
      setMessage(result.error?.message ?? "Your live quest is ready.");
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
