"use client";

import { useRef, useState } from "react";
import { QuestSubmissionGate } from "../generation/submission-gate";
import { toRuntimeQuest } from "../live-quest";
import type { Difficulty, Quest } from "../types";

type LiveQuestResponse = {
  error?: {
    code?: string;
    message?: string;
    retryAfterSeconds?: number;
  };
  quest?: unknown;
};

function liveFailureMessage(error: NonNullable<LiveQuestResponse["error"]>) {
  if (error.code === "RATE_LIMITED" && error.retryAfterSeconds)
    return `Live AI is at its request limit. Try again in about ${error.retryAfterSeconds} seconds, or play the ready-made quest now.`;
  return (
    error.message ??
    "Live generation is unavailable. Play the ready-made quest."
  );
}

export function LiveQuestSetup({
  defaultOpen = false,
  difficulty,
  liveAvailable,
  onOpenChange,
  onQuestReady,
}: {
  defaultOpen?: boolean;
  difficulty: Difficulty;
  liveAvailable: boolean;
  onOpenChange?: (open: boolean) => void;
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
    if (!file.type.startsWith("text/") || file.size > 10000) {
      setFileMessage(
        "Choose a plain-text file smaller than 10 KB, or paste text instead.",
      );
      return;
    }
    const sourceText = await file.text();
    if (sourceText.trim().length < 100) {
      setFileMessage(
        "This file needs at least 100 characters before it can make a useful quest.",
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
    if (!liveAvailable) {
      setMessage(
        "Live AI is off for this deployment. Play the ready-made quest instead.",
      );
      return;
    }
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
          const payload = (await response.json().catch(() => undefined)) as
            | LiveQuestResponse
            | undefined;
          if (payload && typeof payload === "object") return payload;
          return {
            error: {
              code: "GENERATION_UNAVAILABLE",
              message:
                response.status === 413
                  ? "Your material is too large for live generation."
                  : "Live generation returned an unreadable response. Try again or play the ready-made quest.",
            },
          };
        },
        (result) => !result.error && toRuntimeQuest(result.quest) !== undefined,
      );
      if (result.error) {
        setMessage(liveFailureMessage(result.error));
        return;
      }
      const quest = toRuntimeQuest(result.quest);
      if (!quest) {
        setMessage(
          "Live generation returned an invalid quest. Try again or play the ready-made quest.",
        );
        return;
      }
      onQuestReady(quest);
      setMessage("Your live quest is ready.");
    } catch (error) {
      setMessage(
        error instanceof Error && error.message === "REQUEST_ALREADY_COMPLETED"
          ? "This quest has already loaded. Start a new setup to generate another."
          : "The network request did not complete. Check your connection, then try again or play the ready-made quest.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <details
      className="live-setup"
      open={defaultOpen || undefined}
      onToggle={(event) => onOpenChange?.(event.currentTarget.open)}
    >
      <summary className="live-setup-summary">
        <span className="live-summary-copy">
          <span className="live-summary-kicker">Input lane / live AI</span>
          <span className="live-summary-title">
            Create your own quest with Live AI
          </span>
        </span>
        <span
          className={
            liveAvailable
              ? "live-availability is-available"
              : "live-availability"
          }
        >
          {liveAvailable ? "ready" : "offline"}
        </span>
        <span className="live-setup-toggle" aria-hidden="true">
          ↘
        </span>
      </summary>
      <div className="live-setup-body">
        <aside className="live-setup-intro">
          <p className="live-setup-kicker">Source-grounded generation</p>
          <h2>Bring one source into the chamber.</h2>
          <p>
            Give Cumulore a focused excerpt. It will return a validated quest
            you can play immediately.
          </p>
          <div className="live-boundary">
            <span className="live-boundary-index">01</span>
            <div>
              <strong>Data boundary</strong>
              <p>
                Your material is sent to OpenAI for this run and is not
                persisted by this hackathon build.
              </p>
            </div>
          </div>
          {!liveAvailable ? (
            <p className="live-unavailable" role="status">
              Live AI is offline here. The ready-made quest is available to play
              now.
            </p>
          ) : null}
        </aside>
        <form
          className="live-setup-form"
          onSubmit={(event) => {
            event.preventDefault();
            void submit(event.currentTarget);
          }}
        >
          <div className="live-form-heading">
            <div>
              <span className="live-form-kicker">Source packet</span>
              <strong>Shape the run</strong>
            </div>
            <span>100—10,000 characters</span>
          </div>
          <div className="live-field-grid">
            <label>
              Source title
              <input
                ref={sourceTitleRef}
                name="sourceTitle"
                maxLength={120}
                placeholder="e.g. Week 02 — Dataset inspection"
                required
              />
            </label>
            <label>
              Attach plain-text file
              <input
                accept="text/plain,.txt"
                aria-describedby="file-message"
                type="file"
                onChange={(event) => void loadTextFile(event.target.files?.[0])}
              />
            </label>
          </div>
          {fileMessage ? (
            <p id="file-message" className="live-form-status" role="status">
              {fileMessage}
            </p>
          ) : null}
          <label>
            Source text
            <textarea
              ref={sourceTextRef}
              name="sourceText"
              minLength={100}
              maxLength={10000}
              placeholder="Paste the material you want to turn into a quest."
              required
            />
          </label>
          <label>
            Learning goal <span>(optional)</span>
            <input
              name="learningGoal"
              maxLength={240}
              placeholder="What should this help you understand or practise?"
            />
          </label>
          <div className="live-form-footer">
            <label className="consent">
              <input name="consent" type="checkbox" value="true" required />
              <span>I understand this material will be sent to OpenAI.</span>
            </label>
            <button
              aria-busy={isSubmitting}
              className="button button-light"
              disabled={isSubmitting || !liveAvailable}
              type="submit"
            >
              {isSubmitting
                ? "Mapping the source..."
                : liveAvailable
                  ? "Generate live quest"
                  : "Live AI unavailable"}{" "}
              <span aria-hidden="true">↗</span>
            </button>
          </div>
          <p className="live-form-helper">
            Focused material generates faster. Chamber intensity sets the
            question difficulty for the whole quest.
          </p>
        </form>
      </div>
      {message ? (
        <p className="live-message" role="status" aria-live="polite">
          {message}
        </p>
      ) : null}
    </details>
  );
}
