# Cumulore Quest — hackathon progress

This file tracks the temporary Build Week project only. It does **not** change
the production Cumulore roadmap or its current milestone.

## Overall progress: 20%

The accepted plan has five reviewable slices. Q1 is complete; the percentage
reflects one accepted slice in a five-slice plan, not a claim that later safety
or release gates are complete.

| Slice                         | Status      | What it means in plain English                                                                                                               |
| ----------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1 — deterministic foundation | Complete    | A learner can play a built-in quest without AI, network access, or credentials. The app, not generated content, controls scoring and combat. |
| Q2 — source grounding         | Not started | Prove every explanation is tied to supplied source text and that difficulty rules are honest.                                                |
| Q3 — protected Live AI        | Not started | Add the single server route and OpenAI boundary only after deterministic validation is solid.                                                |
| Q4 — experience polish        | Not started | Improve the full journey, mobile layout, accessibility details, and safe failures.                                                           |
| Q5 — release evidence         | Not started | Run evaluations, document the result, and prepare the judge demonstration.                                                                   |

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
