# Cumulore Quest Devpost worksheet

This is a factual submission scaffold, not a finished personal essay. OpenAI's
organisers explicitly ask participants not to submit an AI-written project
description unchanged. Replace bracketed prompts and rewrite the motivation,
challenge, and reflection paragraphs in your natural voice before saving.

## Project overview

**Project name:** `Cumulore Quest`

This name was chosen by the builder before this submission pack. Do not replace
it with an AI-generated variation.

**Elevator pitch:**

> Turn your own study material into a source-grounded learning quest where every
> answer teaches, every claim cites evidence, and progress feels like play.

**Thumbnail:** Use a clean in-product screenshot showing one question, the stage
enemy, and the evidence panel. Avoid OpenAI branding, unreadable text, API
dashboards, or a generic AI illustration. Export JPG or PNG under Devpost's 5 MB
limit. The existing `designs/cumulore.png` is a fallback, but an actual product
screenshot gives stronger evidence of a working experience.

## Project details

### Opening — rewrite personally

Write two or three sentences answering:

- What specific study friction have you personally experienced?
- Why did ordinary flashcards or generic quizzes not solve it?
- What moment made you want to turn source-grounded revision into a game?

Suggested factual bridge, to rewrite rather than paste unchanged:

> Cumulore Quest turns material a learner already has into a three-stage active
> recall quest. It identifies five priority concepts, teaches through immediate
> source-linked feedback, and prepares a focused rematch for concepts the learner
> missed.

### What it does

Cover these verified points in your own phrasing:

- The learner pastes text or loads a plain-text file, chooses one difficulty for
  the whole quest, and can state a learning goal.
- The quest ranks five Priority Focus concepts and creates three cognitively
  progressive stages: foundation, connection, and synthesis.
- Twelve main questions and four prepared rematch questions use validated source
  excerpts. Correct and incorrect answers both show teaching feedback.
- Application code—not the model—owns health, damage, score, hearts, enemies,
  progression, shuffling, and rematch behavior.
- Deterministic Demo works without credentials. Protected Live AI uses the same
  contract and must pass the same validation before content reaches the game.

### How it works

Use a concise technical explanation:

1. A thin Next.js route validates origin, consent, limits, difficulty, goal, and
   source text.
2. The server-only provider calls the OpenAI Responses API with GPT-5.6 Terra,
   strict Structured Outputs, bounded output, a timeout, at most one safe repair,
   and `store: false`.
3. Deterministic code rejects invalid schema, identifiers, source locators,
   excerpts, options, duplicates, or difficulty rules.
4. Validated educational content is adapted into a typed React game state. The
   reducer calculates all combat and scoring independently.
5. Tests cover contract, provenance, provider failures, route behavior, combat,
   mastery, option order, progress, runtime configuration, and submission gates.

### How Codex and GPT-5.6 were used

Personalise this with one concrete example you remember from the build:

- Codex helped decompose the 72-hour idea into reviewable slices, inspect the
  existing monorepo, implement the typed quest boundaries, write adversarial
  tests, diagnose Vercel/OpenAI configuration failures, and verify each change.
- GPT-5.6 was used in Codex for [insert the exact design, implementation, or
  reliability task from your primary session].
- A key decision made with Codex was `content teaches; code plays`: the model may
  create educational material, but deterministic code owns mechanics and rejects
  unsupported evidence.
- The builder chose the product name, target learner, scope, trade-offs, and
  acceptance decisions, and reviewed the generated code and behavior.
- The application also uses GPT-5.6 Terra at runtime for the optional protected
  live generation path; this is separate from using GPT-5.6 inside Codex to build
  the project.

### Challenges, learning, and what is next — write personally

Add one short paragraph for each:

- **Challenge:** Describe a real failure you solved, such as a strict output
  incompatibility, deployment timeout, quota boundary, or provenance rejection.
- **Learning:** Explain what you learned about separating probabilistic content
  generation from deterministic product guarantees.
- **Next:** Mention only credible next steps: broader document formats, spaced
  practice, stronger learning evaluation, and private workspace integration.
  Do not claim they are implemented in the hackathon build.

## Media

**YouTube demo URL:** `[paste after incognito verification]`

Requirements: under three minutes; Public or Unlisted; audible narration; show
the working project; explicitly explain what Codex did and what GPT-5.6 did.

Recommended screenshots:

1. Priority Focus after a quest is generated.
2. A battle question with the enemy and progress visible.
3. Source-grounded answer feedback.
4. Results or targeted rematch.

## Additional info

| Devpost field                      | Value                                                                                                                           |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Submitter Type                     | `Individual`, unless actual accepted teammates contributed.                                                                     |
| Country of Residence               | `Australia`, if that is the submitter's legal country of residence. Confirm rather than copying blindly.                        |
| Category                           | `Education`                                                                                                                     |
| Code repository                    | `https://github.com/HaleyyT/Cumulore/tree/hackathon/openai-build-week-cumulore-quest`                                           |
| Project URL for judges             | `https://cumulore.vercel.app` only after an incognito test proves judges can open it. Otherwise leave the optional field blank. |
| `/feedback` Session ID             | `[run /feedback in the primary Codex build task and paste the returned ID]`                                                     |
| Plugin/developer-tool instructions | Not applicable; Cumulore Quest is an Education app.                                                                             |

If the deployed URL is judge-accessible, use these test instructions:

> Start with Deterministic Demo for a reliable credential-free quest. Choose a
> difficulty, review the five Priority Focus concepts, complete a battle, inspect
> the source evidence after an answer, and try the targeted rematch. Live AI is a
> protected optional path and may be unavailable when its cost boundary is
> closed; the deterministic experience demonstrates the same validated contract
> and application-owned game mechanics.

## Final field review

- No placeholder brackets remain.
- Personal passages sound like the builder when read aloud.
- No feature is described as complete unless it is visible or tested.
- Codex build usage and runtime GPT-5.6 usage are clearly distinguished.
- Repository access has been granted before the private repo URL is saved.
- YouTube and optional project URLs work in an incognito window.
