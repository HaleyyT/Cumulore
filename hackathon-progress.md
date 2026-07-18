# Cumulore Quest — hackathon progress

This file tracks the temporary Build Week project only. It does **not** change
the production Cumulore roadmap or its current milestone.

## Overall progress: 100% for the planned implementation slices

All five implementation slices now have a committed implementation checkpoint.
This is not a claim that a public live deployment is approved: the plan still
requires controlled live evaluation, manual review, and platform cost-gate
evidence before enabling public Live AI.

| Slice                         | Status   | What it means in plain English                                                                                                               |
| ----------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1 — deterministic foundation | Complete | A learner can play a built-in quest without AI, network access, or credentials. The app, not generated content, controls scoring and combat. |
| Q2 — source grounding         | Complete | Deterministic segmentation, provenance, reference, option, duplicate, and difficulty validation fail closed.                                 |
| Q3 — protected Live AI        | Complete | The server-only OpenAI boundary is guarded and disabled by default; fixture mode requires no credential.                                     |
| Q4 — experience polish        | Complete | The responsive demo includes reduced-motion handling, state feedback, keyboard controls, and visual reference assets.                        |
| Q5 — release evidence         | Complete | A deterministic fixture-evaluation command and setup guidance are committed. Controlled live evaluation and deployment evidence remain due.  |

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
