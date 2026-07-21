# Cumulore Quest — hackathon progress

This file tracks the temporary Build Week project only. It does **not** change
the production Cumulore roadmap or its current milestone.

## Overall progress: 94% of planned implementation work

The deterministic and visual implementation work is committed. The evaluation
runner now makes its provider explicit: fixture checks stay credential-free and
the nine-case live matrix cannot run unless all server-only controls are set.
The OpenAI boundary now has deterministic provider and route failure coverage.
Generated source titles are now checked against the application request before a
quest can be accepted.
Validated live educational content now has a narrow adapter into the
application-owned combat runtime.
Successful live responses now load into a reset combat run, while recoverable
generation failures leave the setup available for another safe attempt.
Learners can now paste 100–10,000 characters of material or load a text file,
set a bounded study goal,
and receive source-grounded review notes after their quiz.
The Live AI path now uses smaller source and response ceilings plus concise
explanations, reducing avoidable model work while preserving the full validated
16-question quest.
Quest reliability now also includes run-stable shuffled answer positions, a
true in-app new-run reset, and a progress meter that reaches 100% on early
stage victories.
The documented frozen Node install and full repository verification now pass
with the locked Python environment, including TypeScript/Python contract tests.
The evaluation ledger records only safe aggregate evidence and the 45-question
review procedure. A controlled Medium production smoke now proves generation,
the ready signal, navigation, combat, and grounded feedback. Q5 still needs the
complete nine-case live matrix, manual review, and public cost/rate-limit
evidence before unrestricted Live AI availability.

| Slice                         | Status      | What it means in plain English                                                                                                               |
| ----------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1 — deterministic foundation | Complete    | A learner can play a built-in quest without AI, network access, or credentials. The app, not generated content, controls scoring and combat. |
| Q2 — source grounding         | Complete    | Deterministic segmentation, provenance, reference, option, duplicate, and difficulty validation fail closed.                                 |
| Q3 — protected Live AI        | Complete    | The guarded OpenAI path supports text-file or pasted material, bounded learner goals, review notes, and recoverable generation failures.     |
| Q4 — experience polish        | Complete    | The responsive demo includes reduced-motion handling, state feedback, keyboard controls, and visual reference assets.                        |
| Q5 — release evidence         | In progress | Fixture evaluation and one production smoke pass. The nine-case live matrix, manual review, and public cost/rate-limit evidence remain due.  |

## What Q1 implements

- The **Science of Learning** fixture: five Priority Focus concepts, three
  fixed stages, four questions per stage, and four rematch questions.
- A deterministic combat reducer: correct answers damage the enemy; wrong
  answers cost a heart; duplicate clicks cannot score twice; failed stages can
  be retried from their fixed initial state.
- A small, keyboard-operable quest page with a persistent **Deterministic
  Demo** label and evidence excerpt after each answer.
- A versioned schema fixture and tests so generated educational content cannot
  sneak in health, damage, score, animation, or other game mechanics.

## Remember the boundary

**Content teaches; code plays.** Educational content can supply questions and
evidence. It cannot control health, scoring, hearts, timing, enemies, or game
behavior. Live AI, persistence, accounts, uploads, and production integrations
remain out of scope until their own accepted slices.

## How to follow along

1. Read the current slice in [the accepted plan](docs/build-week/hackathon-plan.md).
2. Check this file for the plain-English status and percentage.
3. Review the matching commit: each completed slice is verified before it is
   committed and pushed to `hackathon/openai-build-week-cumulore-quest` only.
