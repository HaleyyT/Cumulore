# Cumulore Quest — hackathon progress

This file tracks the temporary Build Week project only. It does **not** change
the production Cumulore roadmap or its current milestone.

## Overall progress: 89% of planned implementation work

The deterministic and visual implementation work is committed. The evaluation
runner now makes its provider explicit: fixture checks stay credential-free and
the nine-case live matrix cannot run unless all server-only controls are set.
The OpenAI boundary now has deterministic provider and route failure coverage.
Generated source titles are now checked against the application request before a
quest can be accepted.
Validated live educational content now has a narrow adapter into the
application-owned combat runtime.
The evaluation ledger records only safe aggregate evidence and the 45-question
review procedure. Q5 still needs the controlled live run, manual review,
deployment, and cost-gate evidence before public Live AI can be enabled.

| Slice                         | Status      | What it means in plain English                                                                                                               |
| ----------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1 — deterministic foundation | Complete    | A learner can play a built-in quest without AI, network access, or credentials. The app, not generated content, controls scoring and combat. |
| Q2 — source grounding         | Complete    | Deterministic segmentation, provenance, reference, option, duplicate, and difficulty validation fail closed.                                 |
| Q3 — protected Live AI        | Complete    | The server-only OpenAI route is guarded, disabled by default, and has deterministic provider, repair, and route safety coverage.             |
| Q4 — experience polish        | Complete    | The responsive demo includes reduced-motion handling, state feedback, keyboard controls, and visual reference assets.                        |
| Q5 — release evidence         | In progress | Fixture evaluation, guarded live command, and safe evidence ledger are committed. Controlled live/manual review and deployment remain due.   |

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
