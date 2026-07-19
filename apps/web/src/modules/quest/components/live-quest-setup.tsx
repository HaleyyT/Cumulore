"use client";

import { useRef, useState } from "react";
import { QuestSubmissionGate } from "../generation/submission-gate";
import { toRuntimeQuest } from "../live-quest";
import type { Difficulty, Quest } from "../types";

type LiveQuestResponse = {
  error?: { code?: string; message?: string };
  quest?: unknown;
};

export function LiveQuestSetup({
  difficulty,
  onQuestReady,
}: {
  difficulty: Difficulty;
  onQuestReady: (quest: Quest) => void;
}) {
  const gate = useRef(new QuestSubmissionGate<LiveQuestResponse>());
  const sourceTitleRef = useRef<HTMLInputElement>(null);
  const sourceTextRef = useRef<HTMLTextAreaElement>(null);
  const [fileMessage, setFileMessage] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string>();

  async function loadTextFile(file: File | undefined) {
    setFileMessage(undefined);
    if (!file) return;
    if (!file.type.startsWith("text/") || file.size > 20000) {
      setFileMessage(
        "Choose a plain-text file smaller than 20 KB, or paste text instead.",
      );
      return;
    }
    const sourceText = await file.text();
    if (sourceText.trim().length < 500) {
      setFileMessage(
        "This file needs at least 500 characters before it can make a useful quest.",
      );
      return;
    }
    if (sourceTextRef.current) sourceTextRef.current.value = sourceText;
    if (sourceTitleRef.current && !sourceTitleRef.current.value.trim())
      sourceTitleRef.current.value = file.name.replace(/\.[^.]+$/, "");
    setFileMessage(
      "Text loaded. Check the title, goal, and difficulty before generating.",
    );
  }

  async function submit(form: HTMLFormElement) {
    setMessage(undefined);
    setIsSubmitting(true);
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
        setMessage(
          result.error.code === "LIVE_MODE_DISABLED"
            ? "Live generation is not enabled in this deployment. Use Deterministic Demo, or configure Live AI locally before trying again."
            : (result.error.message ?? "Live generation is unavailable."),
        );
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
    } finally {
      setIsSubmitting(false);
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
      <p className="live-setup-helper">
        Paste 500 to 20,000 characters, or load a plain-text file. The selected
        chamber intensity sets the question difficulty for the whole quest.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit(event.currentTarget);
        }}
      >
        <label>
          Source title
          <input
            ref={sourceTitleRef}
            name="sourceTitle"
            maxLength={120}
            required
          />
        </label>
        <label>
          Load a plain-text file (optional)
          <input
            accept="text/plain,.txt"
            aria-describedby="file-message"
            type="file"
            onChange={(event) => void loadTextFile(event.target.files?.[0])}
          />
        </label>
        {fileMessage ? (
          <p id="file-message" role="status">
            {fileMessage}
          </p>
        ) : null}
        <label>
          Source text
          <textarea
            ref={sourceTextRef}
            name="sourceText"
            minLength={500}
            maxLength={20000}
            required
          />
        </label>
        <label>
          What should this help you learn? (optional)
          <input
            name="learningGoal"
            maxLength={240}
            placeholder="For example: practise reductions and distinguish NP from NP-hard"
          />
        </label>
        <label className="consent">
          <input name="consent" type="checkbox" value="true" required /> I
          understand this material will be sent to OpenAI.
        </label>
        <button
          className="button button-light"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? "Building your quest..." : "Generate live quest"}{" "}
          <span aria-hidden="true">↗</span>
        </button>
      </form>
      {message ? <p role="status">{message}</p> : null}
    </details>
  );
}
