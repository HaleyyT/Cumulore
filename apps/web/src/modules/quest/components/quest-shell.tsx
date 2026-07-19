"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import { scienceQuest } from "../fixture";
import { calculateMastery, orderRematch } from "../mastery";
import { LiveQuestSetup } from "./live-quest-setup";
import {
  answer,
  continueQuest,
  initialBattle,
  next,
  retryStage,
} from "../reducer";
import type { Battle, Difficulty } from "../types";

gsap.registerPlugin(ScrollTrigger);

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

const signalWords = ["Recall", "spacing", "feedback", "transfer", "connection"];

function LogoMark() {
  return (
    <span aria-hidden="true" className="logo-mark">
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-pill">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function FocusHeading({ text }: { text: string }) {
  const [lead, tail] = text.split(" - ");

  if (!tail) return text;

  return (
    <>
      <span className="focus-line">{lead}</span>
      <span className="focus-line">{tail}</span>
    </>
  );
}

type DustParticle = {
  alpha: number;
  phase: number;
  radius: number;
  speed: number;
  x: number;
  y: number;
  renderX: number;
  renderY: number;
};

function GalaxyField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const surface = canvas?.parentElement;
    const context = canvas?.getContext("2d");

    if (!canvas || !surface || !context) return undefined;

    let animationFrame = 0;
    let width = 0;
    let height = 0;
    let pixelRatio = 1;
    let hasDrawn = false;
    const pointer = { active: false, x: 0, y: 0 };
    let seed = 271828;
    const nextRandom = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };

    const particles: DustParticle[] = Array.from({ length: 180 }, () => {
      const x = 0.035 + nextRandom() * 0.93;
      const y = 0.045 + nextRandom() * 0.91;
      return {
        alpha: 0.18 + nextRandom() * 0.68,
        phase: nextRandom() * Math.PI * 2,
        radius: 0.25 + Math.pow(nextRandom(), 1.8) * 1.25,
        speed: 0.00018 + nextRandom() * 0.00042,
        x,
        y,
        renderX: 0,
        renderY: 0,
      };
    });

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      width = bounds.width;
      height = bounds.height;
      pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(width * pixelRatio));
      canvas.height = Math.max(1, Math.floor(height * pixelRatio));
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      particles.forEach((particle) => {
        particle.renderX = particle.x * width;
        particle.renderY = particle.y * height;
      });
      hasDrawn = false;
    };

    const draw = (time: number) => {
      context.clearRect(0, 0, width, height);
      context.save();
      context.globalCompositeOperation = "screen";

      particles.forEach((particle) => {
        const waveX = Math.sin(time * particle.speed + particle.phase) * 2.2;
        const waveY =
          Math.cos(time * particle.speed * 0.78 + particle.phase) * 1.8;
        let targetX = particle.x * width + waveX;
        let targetY = particle.y * height + waveY;

        if (pointer.active) {
          const distanceX = targetX - pointer.x;
          const distanceY = targetY - pointer.y;
          const distance = Math.hypot(distanceX, distanceY);
          const influenceRadius = 180;

          if (distance < influenceRadius) {
            const strength = Math.pow(1 - distance / influenceRadius, 2);
            const safeDistance = Math.max(distance, 1);
            const push = strength * 58;
            targetX +=
              (distanceX / safeDistance) * push - distanceY * strength * 0.08;
            targetY +=
              (distanceY / safeDistance) * push + distanceX * strength * 0.08;
          }
        }

        particle.renderX += (targetX - particle.renderX) * 0.09;
        particle.renderY += (targetY - particle.renderY) * 0.09;
        const twinkle =
          0.72 + Math.sin(time * particle.speed * 5 + particle.phase) * 0.28;
        const alpha = Math.max(0.06, particle.alpha * twinkle);

        context.beginPath();
        context.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        context.arc(
          particle.renderX,
          particle.renderY,
          particle.radius,
          0,
          Math.PI * 2,
        );
        context.fill();

        if (particle.radius > 1.15) {
          context.beginPath();
          context.fillStyle = `rgba(255, 255, 255, ${alpha * 0.14})`;
          context.arc(
            particle.renderX,
            particle.renderY,
            particle.radius * 3.8,
            0,
            Math.PI * 2,
          );
          context.fill();
        }
      });

      context.restore();
      hasDrawn = true;
    };

    const handlePointerMove = (event: PointerEvent) => {
      const bounds = surface.getBoundingClientRect();
      pointer.x = event.clientX - bounds.left;
      pointer.y = event.clientY - bounds.top;
      pointer.active = true;
    };
    const handlePointerLeave = () => {
      pointer.active = false;
    };

    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(surface);
    surface.addEventListener("pointermove", handlePointerMove, {
      passive: true,
    });
    surface.addEventListener("pointerleave", handlePointerLeave);

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const frame = (time: number) => {
      draw(time);
      animationFrame = window.requestAnimationFrame(frame);
    };

    if (reducedMotion.matches) {
      draw(0);
    } else {
      animationFrame = window.requestAnimationFrame(frame);
    }

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      surface.removeEventListener("pointermove", handlePointerMove);
      surface.removeEventListener("pointerleave", handlePointerLeave);
      if (hasDrawn) context.clearRect(0, 0, width, height);
    };
  }, []);

  return (
    <canvas ref={canvasRef} className="particle-field" aria-hidden="true" />
  );
}

export function QuestShell() {
  const shellRef = useRef<HTMLElement>(null);
  const battleTitleRef = useRef<HTMLHeadingElement>(null);
  const feedbackRef = useRef<HTMLElement>(null);
  const previousStageRef = useRef<number | undefined>(undefined);
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
  const [rematchIndex, setRematchIndex] = useState<number>();
  const [rematchAnswer, setRematchAnswer] = useState<string>();
  const stage = quest.stages[battle.stage];

  useEffect(() => {
    if (!shellRef.current) return undefined;
    const context = gsap.context(() => {
      gsap.fromTo(
        ".hero-kicker, .hero-title, .hero-copy, .hero-actions",
        { opacity: 0, y: 28 },
        { opacity: 1, y: 0, duration: 0.9, stagger: 0.09, ease: "power3.out" },
      );
      gsap.fromTo(
        ".hero-art",
        { opacity: 0, scale: 0.86, rotate: -4 },
        { opacity: 1, scale: 1, rotate: 0, duration: 1.4, ease: "expo.out" },
      );
      gsap.to(".orbit-core", {
        rotate: 360,
        duration: 22,
        repeat: -1,
        ease: "none",
      });
      gsap.to(".pulse-core", {
        scale: 1.18,
        opacity: 0.68,
        duration: 1.8,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });
      gsap.utils
        .toArray<HTMLElement>("[data-reveal]")
        .forEach((element, index) => {
          gsap.fromTo(
            element,
            { opacity: 0, y: 42, scale: 0.96 },
            {
              opacity: 1,
              y: 0,
              scale: 1,
              duration: 0.9,
              delay: index * 0.04,
              ease: "power3.out",
              scrollTrigger: {
                trigger: element,
                start: "top 88%",
                end: "top 58%",
                scrub: true,
              },
            },
          );
        });
      gsap.fromTo(
        ".signal-word",
        { opacity: 0.18, y: 12 },
        {
          opacity: 1,
          y: 0,
          stagger: 0.12,
          ease: "none",
          scrollTrigger: {
            trigger: ".signal-copy",
            start: "top 78%",
            end: "bottom 55%",
            scrub: true,
          },
        },
      );
      ScrollTrigger.create({
        trigger: ".battle-rail",
        start: "top 112px",
        endTrigger: ".battle-card",
        end: "bottom bottom",
        pin: ".battle-aside",
        pinSpacing: false,
      });
    }, shellRef);
    return () => context.revert();
  }, []);

  useEffect(() => {
    if (battle.feedback) {
      feedbackRef.current?.focus();
    } else if (
      previousStageRef.current !== undefined &&
      previousStageRef.current !== battle.stage
    ) {
      battleTitleRef.current?.focus();
    }

    previousStageRef.current = battle.stage;
  }, [battle.feedback, battle.stage]);

  if (!stage) {
    const mastery = calculateMastery(quest, battle.answered);
    const rematch = orderRematch(quest, mastery);
    const rematchQuestion = rematch[rematchIndex ?? 0];
    return (
      <main ref={shellRef} className="app-shell">
        <nav className="topbar" aria-label="Primary navigation">
          <a className="brand" href="#top">
            <LogoMark />
            <span>CUMULORE / QUEST</span>
          </a>
          <span className="nav-status">
            <i />
            run archived
          </span>
        </nav>
        <section className="completion-screen" id="top">
          <p className="hero-kicker">The loop is complete</p>
          <h1 className="completion-title">You built a durable signal.</h1>
          <p>
            Your Science of Learning run is complete. The next challenge starts
            with a fresh set of connections.
          </p>
          <p className="completion-score">{battle.score} points banked</p>
          <section className="completion-review" aria-labelledby="review-title">
            <h2 id="review-title">Your learning signal</h2>
            <ul>
              {mastery.map((item) => (
                <li key={item.conceptId}>
                  <span>
                    {
                      quest.concepts.find(
                        (concept) => concept.id === item.conceptId,
                      )?.title
                    }
                  </span>
                  <strong>
                    {item.mastery === undefined
                      ? "Not sampled"
                      : `${Math.round(item.mastery * 100)}% mastery`}
                  </strong>
                </li>
              ))}
            </ul>
            <p>Next rematch: {rematch[0]?.prompt}</p>
            {rematchQuestion ? (
              <div className="rematch-panel">
                <h3>Weak-topic rematch</h3>
                <p>{rematchQuestion.prompt}</p>
                {rematchQuestion.options.map((option) => (
                  <button
                    className="answer-choice"
                    disabled={Boolean(rematchAnswer)}
                    key={option.id}
                    type="button"
                    onClick={() => setRematchAnswer(option.id)}
                  >
                    {option.text}
                  </button>
                ))}
                {rematchAnswer ? (
                  <div role="status">
                    <p>
                      {rematchAnswer === rematchQuestion.correctId
                        ? "Correct."
                        : "Keep practising."}{" "}
                      {rematchQuestion.explanation}
                    </p>
                    <button
                      className="button button-light"
                      type="button"
                      onClick={() => {
                        setRematchAnswer(undefined);
                        setRematchIndex((rematchIndex ?? 0) + 1);
                      }}
                    >
                      Next rematch <span aria-hidden="true">↗</span>
                    </button>
                  </div>
                ) : null}
              </div>
            ) : (
              <p>Rematch complete. Your next full run is ready when you are.</p>
            )}
          </section>
          <button
            className="button button-primary"
            type="button"
            onClick={() => window.location.reload()}
          >
            Play the loop again <span aria-hidden="true">↗</span>
          </button>
        </section>
      </main>
    );
  }

  const question = stage.questions[battle.question];
  const canContinue =
    !battle.feedback && !battle.stageFailed && battle.health === 0;
  const stageProgress = Math.round(
    (battle.question / Math.max(stage.questions.length, 1)) * 100,
  );
  const correctAnswer = battle.selected === question?.correctId;

  return (
    <main ref={shellRef} className="app-shell" id="top">
      <nav className="topbar" aria-label="Primary navigation">
        <a className="brand" href="#top">
          <LogoMark />
          <span>CUMULORE / QUEST</span>
        </a>
        <div className="nav-links">
          <a href="#map">Learning map</a>
          <a href="#quest">Enter chamber</a>
        </div>
        <span className="nav-status">
          <i /> live run
        </span>
      </nav>

      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy-wrap">
          <p className="hero-kicker">
            <span className="live-dot" /> Science of Learning / live chamber
          </p>
          <h1 className="hero-title" id="hero-title">
            <span className="hero-line">Build a mind that</span>
            <span className="hero-line">
              <span className="lego-word" aria-label="retains">
                retains
              </span>{" "}
              <em>what matters.</em>
            </span>
          </h1>
          <p className="hero-copy">
            A source-grounded boss battle for the ideas that make learning
            stick. Make the effort visible. Keep the signal.
          </p>
          <aside className="mode-disclosure" aria-label="Quest mode">
            <strong>Deterministic Demo</strong>
            <span>
              This run uses built-in learning material. Live AI is off unless
              explicitly enabled by the server.
            </span>
          </aside>
          <LiveQuestSetup difficulty={difficulty} />
          <div className="hero-actions">
            <a className="button button-primary" href="#quest">
              Enter the chamber <span aria-hidden="true">↗</span>
            </a>
            <a className="button button-ghost" href="#map">
              View learning map <span aria-hidden="true">↓</span>
            </a>
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <GalaxyField />
          <div className="art-grid" />
          <div className="orbit-core">
            <div className="orbit-ring orbit-ring-one" />
            <div className="orbit-ring orbit-ring-two" />
            <div className="orbit-ring orbit-ring-three" />
            <div className="pulse-core" />
            <span className="orbit-block orbit-block-a" />
            <span className="orbit-block orbit-block-b" />
            <span className="orbit-block orbit-block-c" />
            <span className="orbit-block orbit-block-d" />
          </div>
          <span className="art-caption">RECALL / 001</span>
        </div>
      </section>

      <section className="signal-strip" aria-label="Learning signal">
        <span>Learning is a system</span>
        <div className="marquee" aria-hidden="true">
          {[...signalWords, ...signalWords].map((word, index) => (
            <span key={word + index}>
              {word} <b>+</b>
            </span>
          ))}
        </div>
        <span>Make the effort visible</span>
      </section>

      <section className="map-section" id="map" aria-labelledby="map-title">
        <div className="section-heading" data-reveal>
          <div>
            <p className="eyebrow">Your learning map</p>
            <h2 id="map-title">Five signals. One stronger mind.</h2>
          </div>
          <p className="section-intro">
            Each concept is a brick in the same system: recall, spacing,
            discrimination, correction, and transfer.
          </p>
        </div>
        <div className="bento-grid">
          {quest.concepts.map((concept, index) => (
            <article
              className={"concept-card concept-card-" + (index + 1)}
              data-reveal
              key={concept.id}
            >
              <div className="card-topline">
                <span className="concept-index">0{index + 1}</span>
                <span className="concept-state">signal online</span>
              </div>
              <div>
                <h3>{concept.title}</h3>
                <p>{concept.reason}</p>
              </div>
              <span className="card-arrow" aria-hidden="true">
                ↗
              </span>
            </article>
          ))}
        </div>
      </section>

      <section className="signal-copy-section" aria-label="Learning principle">
        <p className="eyebrow">A better kind of difficulty</p>
        <p className="signal-copy">
          <span className="signal-line">
            <span className="signal-word">Transform</span>{" "}
            <span className="signal-word">challenge</span>{" "}
            <span className="signal-word">into</span>{" "}
            <span className="signal-word">an</span>
          </span>{" "}
          <span className="signal-line">
            <span className="signal-word">enjoyable</span>{" "}
            <span className="signal-word">learning</span>{" "}
            <span className="signal-word">experience</span>
          </span>
        </p>
      </section>

      <section
        className="battle-rail"
        id="quest"
        aria-labelledby="battle-title"
      >
        <aside className="battle-aside" data-reveal>
          <div className="aside-heading">
            <p className="eyebrow">Live quest chamber</p>
            <span className="stage-chip">{stage.focus}</span>
          </div>
          <h2>
            <span className="aside-title-line">effort that sticks</span>
            <span className="aside-title-line">effortlessly</span>
          </h2>
          <p>
            Build a system that never miss important information. Every answer
            reshapes the map.
          </p>
          <div className="aside-divider" />
          <label className="difficulty-control" htmlFor="difficulty">
            <span>Chamber intensity</span>
            <select
              id="difficulty"
              value={difficulty}
              disabled={battle.question > 0 || battle.stage > 0}
              onChange={(event) =>
                setDifficulty(event.target.value as Difficulty)
              }
            >
              <option value="easy">Easy orbit</option>
              <option value="medium">Medium orbit</option>
              <option value="hard">Hard orbit</option>
            </select>
          </label>
          <div className="aside-note">
            <span className="status-swatch" />
            <span>Content is grounded in the supplied learning material.</span>
          </div>
        </aside>

        <div className="battle-card" data-reveal>
          <div className="battle-card-top">
            <div>
              <p className="eyebrow">Current focus</p>
              <h2 id="battle-title" ref={battleTitleRef} tabIndex={-1}>
                <FocusHeading text={stage.misconception} />
              </h2>
            </div>
            <span className="battle-count">
              {String(battle.question + 1).padStart(2, "0")} /{" "}
              {String(stage.questions.length).padStart(2, "0")}
            </span>
          </div>
          <div
            className="battle-meter"
            aria-label={"Stage progress " + stageProgress + "%"}
          >
            <span style={{ width: Math.max(stageProgress, 8) + "%" }} />
          </div>
          <div className="battle-stats" aria-live="polite">
            <StatPill label="Enemy health" value={battle.health + "%"} />
            <StatPill label="Signal streak" value={battle.streak + "x"} />
            <StatPill label="Score" value={String(battle.score)} />
            <div
              className="health-pips"
              aria-label={battle.hearts + " hearts remaining"}
            >
              {Array.from({ length: 5 }).map((_, index) => (
                <span
                  className={index < battle.hearts ? "is-live" : ""}
                  key={index}
                />
              ))}
            </div>
          </div>

          {battle.stageFailed ? (
            <div className="stage-result" role="status">
              <span className="result-mark">!</span>
              <div>
                <h3>Recalibration required</h3>
                <p>
                  The misconception held this round. Retry the fixed questions
                  and build the signal again.
                </p>
                <button
                  className="button button-light"
                  type="button"
                  onClick={() => dispatch({ type: "retry" })}
                >
                  Retry stage <span aria-hidden="true">↗</span>
                </button>
              </div>
            </div>
          ) : canContinue ? (
            <div className="stage-result stage-result-success" role="status">
              <span className="result-mark">✓</span>
              <div>
                <h3>Signal locked</h3>
                <p>The next stage keeps your selected chamber intensity.</p>
                <button
                  className="button button-light"
                  type="button"
                  onClick={() => dispatch({ type: "continue" })}
                >
                  Continue quest <span aria-hidden="true">↗</span>
                </button>
              </div>
            </div>
          ) : question ? (
            <div className="answer-panel">
              <p className="question-prompt">{question.prompt}</p>
              <div aria-label="Answer options" className="answer-options">
                {question.options.map((option, index) => (
                  <button
                    className="answer-choice"
                    key={option.id}
                    type="button"
                    disabled={Boolean(battle.feedback)}
                    onClick={() =>
                      dispatch({ type: "answer", optionId: option.id })
                    }
                  >
                    <span className="choice-index">
                      {String.fromCharCode(65 + index)}
                    </span>
                    <span>{option.text}</span>
                    <span className="choice-arrow" aria-hidden="true">
                      ↗
                    </span>
                  </button>
                ))}
              </div>
              {battle.feedback ? (
                <aside
                  ref={feedbackRef}
                  className={
                    correctAnswer
                      ? "feedback-card is-correct"
                      : "feedback-card is-wrong"
                  }
                  tabIndex={-1}
                  aria-live="polite"
                >
                  <div className="feedback-heading">
                    <span className="result-mark">
                      {correctAnswer ? "✓" : "!"}
                    </span>
                    <strong>
                      {correctAnswer ? "Correct signal" : "Not quite"}
                    </strong>
                  </div>
                  <p>{question.explanation}</p>
                  <blockquote>{question.excerpt}</blockquote>
                  <button
                    className="button button-light"
                    type="button"
                    onClick={() => dispatch({ type: "next" })}
                  >
                    Keep moving <span aria-hidden="true">↗</span>
                  </button>
                </aside>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      <footer className="site-footer">
        <div className="footer-glow" aria-hidden="true" />
        <div className="footer-inner">
          <p className="eyebrow">Keep the signal alive</p>
          <h2>Make the next connection count.</h2>
          <a className="button button-primary" href="#quest">
            Return to chamber <span aria-hidden="true">↗</span>
          </a>
          <div className="footer-meta">
            <span>CUMULORE / SCIENCE OF LEARNING</span>
            <span>Source-grounded practice / 2026</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
