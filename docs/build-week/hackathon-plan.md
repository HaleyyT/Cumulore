# Cumulore Quest — OpenAI Build Week 72-Hour Implementation Plan

- **Status:** Accepted for implementation
- **Readiness score:** 97/100
- **Implementation target:** Terra, medium reasoning
- **Time box:** 72 hours
- **Track:** Education

## Scope isolation

This document is the implementation source of truth for the temporary OpenAI
Build Week project **Cumulore Quest**. It is deliberately isolated from the
production Cumulore roadmap.

- Do not replace or edit `specs/current-milestone.md` for this work.
- Do not reuse production database, tenancy, worker, ingestion, retrieval, or
  authentication paths.
- Do not add migrations, queues, object storage, Redis, Kafka, or another
  backend framework.
- Keep the implementation on the hackathon branch until it has passed the
  acceptance gates in this plan.
- Product guarantees in `AGENTS.md` still apply, especially provenance,
  uncertainty, private-data handling, and trust-boundary validation.

The plan is accepted because every implementation decision needed for P0 has a
defined owner, interface, fallback, and acceptance check. The remaining three
points reflect deployment controls that must be evidenced on the selected
hosting platform; they do not block a safe fixture-first submission.

## 1. Product outcome and boundaries

### Product promise

Cumulore Quest turns a learner's material into a short, source-grounded boss
battle. Each enemy represents a misconception. Correct answers deal damage,
evidence cards explain why an answer is supported, and a final rematch targets
the concepts the learner found hardest.

The differentiator is not a generic AI quiz. The experience combines:

1. **Priority Focus:** five ranked concepts explain what deserves attention.
2. **Progressive cognition:** foundation, connection, and synthesis stages use
   the same user-selected difficulty while advancing conceptual purpose.
3. **Visible evidence:** explanations cite an excerpt from the supplied source.
4. **Deterministic play:** application code owns combat, scoring, accessibility,
   and failure states; the model generates educational material only.
5. **Targeted practice:** prepared rematch questions are ordered using observed
   mistakes rather than model-controlled game behavior.

### Primary journey

1. The learner chooses **Deterministic Demo** or **Live AI**.
2. Demo mode loads the built-in _Science of Learning_ fixture. Live mode accepts
   a title, pasted text, and one difficulty for the entire quest.
3. Live mode displays the material-processing disclosure before submission.
4. The learner reviews five Priority Focus concepts.
5. The learner fights three fixed stages with four questions each.
6. After each answer, the interface reveals the explanation and source excerpt.
7. Results show mastery by concept and offer four weak-topic rematch questions.

### P0, P1, and cut line

**P0 must ship:**

- responsive single-page quest experience at `/`;
- built-in, deterministic _Science of Learning_ demo;
- Easy, Medium, and Hard quest-wide difficulty;
- five Priority Focus concepts;
- three stages, twelve main questions, and four rematch questions;
- deterministic reducer, combat, scoring, hearts, and mastery calculation;
- evidence card for every answer and takeaway;
- optional protected live GPT-5.6 generation through one server route;
- explicit Live AI versus Deterministic Demo labeling;
- keyboard, screen-reader, contrast, focus, and reduced-motion support;
- production build, automated tests, evaluation evidence, README, and demo video.

**P1 only after P0 is green:** an additional checked fixture, richer transitions,
and a downloadable text summary. **Stretch is excluded:** accounts, persistence,
leaderboards, multiplayer, audio, image generation, file upload, OCR, analytics,
sharing services, or production Cumulore integrations.

If time is threatened, cut in this order: public live mode, P1 polish, optional
summary export. Never cut fixture mode, provenance validation, accessibility,
safe failures, or the judge-demo verification.

## 2. Repository and module design

Use the existing Next.js application and strict TypeScript configuration. Keep
route handlers thin and business rules under `apps/web/src/modules/quest/`.

```text
docs/build-week/
└── hackathon-plan.md

apps/web/src/
├── app/
│   ├── api/quest/generate/route.ts
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
└── modules/quest/
    ├── components/
    │   ├── answer-panel.tsx
    │   ├── battle-stage.tsx
    │   ├── evidence-card.tsx
    │   ├── priority-focus.tsx
    │   ├── quest-results.tsx
    │   ├── quest-setup.tsx
    │   └── quest-shell.tsx
    ├── generation/
    │   ├── fixture-provider.ts
    │   ├── openai-provider.ts
    │   ├── provider.ts
    │   ├── quest-service.ts
    │   └── repair.ts
    ├── combat.ts
    ├── difficulty.ts
    ├── mastery.ts
    ├── priority.ts
    ├── provenance.ts
    ├── reducer.ts
    ├── runtime-config.ts
    ├── source-segmentation.ts
    ├── types.ts
    └── validation.ts

packages/schemas/
├── contracts/quest-generation.v1.schema.json
├── fixtures/quest-generation.v1.invalid.json
├── fixtures/quest-generation.v1.valid.json
└── src/quest-generation.ts

apps/web/tests/
├── quest-api.test.ts
├── quest-combat.test.ts
├── quest-generation.test.ts
├── quest-provenance.test.ts
└── quest-reducer.test.ts

apps/web/scripts/
└── evaluate-quest-generation.mts

apps/web/test-fixtures/quest/
├── generated/
│   ├── science-of-learning.easy.json
│   ├── science-of-learning.hard.json
│   └── science-of-learning.medium.json
├── http-request-lifecycle.txt
├── photosynthesis-and-respiration.txt
└── science-of-learning.txt
```

The implementation may split a listed module when it improves readability, but
must preserve these boundaries:

- components render state and dispatch typed actions;
- the reducer and pure domain functions own all mechanics;
- providers obtain educational output only;
- `QuestService` owns segmentation, provider invocation, validation, repair,
  provenance checks, and safe result mapping;
- the API route validates transport input and maps typed service results to HTTP;
- the shared schema package owns the versioned generated-data contract.

### Dependencies

The only permitted new external production dependency is the official `openai`
Node SDK, and its version is not pre-approved.

During the OpenAI slice:

1. run `pnpm view openai version`;
2. inspect the candidate SDK's TypeScript declarations for the Responses API,
   `store`, and Structured Outputs through `text.format`;
3. compile a minimal repository test using the required request shape;
4. pin that exact compatible version;
5. update only the relevant package manifest and `pnpm-lock.yaml`.

Add `@cumulore/schemas: workspace:*` to the web application because both the
route and service need the repository's versioned runtime validator. Reuse the
existing Ajv, `tsx`, TypeScript, ESLint, Prettier, and `node:assert/strict` stack.
Do not add Zod, Phaser, Redux, an ORM, an animation library, a CSS framework, or
a test framework. React state plus a typed reducer and CSS/SVG are sufficient.

## 3. Public interfaces and educational contract

### Generation request

`POST /api/quest/generate` uses `multipart/form-data` and the Node.js runtime.

| Field                 | Rule                                                    |
| --------------------- | ------------------------------------------------------- |
| `requestId`           | required UUID generated once per browser submission     |
| `mode`                | `fixture` or `live`                                     |
| `requestedDifficulty` | `easy`, `medium`, or `hard`; applies to the whole quest |
| `sourceTitle`         | live only; trimmed, 1–120 characters                    |
| `sourceText`          | live only; normalized, 500–20,000 Unicode characters    |
| `demoSourceId`        | fixture only; P0 permits only `science-of-learning`     |

Exactly one source mode is accepted. Reject unknown fields, malformed UUIDs,
unsupported modes, oversized bodies, invalid UTF-8, missing disclosure consent
for live mode, and inconsistent fixture/live fields before provider access.

Success:

```ts
type GenerateQuestResponse = {
  requestId: string;
  mode: "fixture" | "live";
  quest: QuestGenerationV1;
  priorityBands: Record<string, PriorityBand>;
};
```

Safe failures use a stable code and message only:

```ts
type GenerateQuestError = {
  requestId?: string;
  error: {
    code:
      | "INVALID_REQUEST"
      | "SOURCE_TOO_LARGE"
      | "LIVE_MODE_DISABLED"
      | "RATE_LIMITED"
      | "GENERATION_TIMEOUT"
      | "GENERATION_INVALID"
      | "GENERATION_UNAVAILABLE";
    message: string;
    retryAfterSeconds?: number;
  };
};
```

Use `400`, `413`, `422`, `429`, and `503` consistently. Never return an upstream
response, prompt, source excerpt, stack trace, API key, or internal error string.

### `QuestGenerationV1`

The model-generated contract contains educational content only:

```ts
type Difficulty = "easy" | "medium" | "hard";
type CognitiveFocus = "foundation" | "connection" | "synthesis";
type PriorityBand = "critical" | "high" | "medium" | "low" | "baseline";

type CognitiveOperation =
  | "recognize"
  | "recall"
  | "relate"
  | "sequence"
  | "apply_familiar"
  | "explain"
  | "differentiate"
  | "cause_effect"
  | "combine"
  | "apply_multistep"
  | "infer"
  | "discriminate"
  | "qualify"
  | "integrate"
  | "diagnose"
  | "transfer"
  | "evaluate";

interface QuestGenerationV1 {
  schemaVersion: 1;
  requestedDifficulty: Difficulty;
  sourceTitle: string;
  priorityConcepts: FivePriorityConcepts;
  stages: ThreeQuestStages;
  rematchQuestions: FourQuestQuestions;
  reviewTakeaways: ThreeGroundedTakeaways;
}

interface PriorityConcept {
  conceptId: string;
  title: string;
  learningObjective: string;
  priorityReason: string;
  evidence: SourceEvidence[];
}

interface QuestStage {
  stageId: string;
  cognitiveFocus: CognitiveFocus;
  educationalMisconception: string;
  conceptIds: string[];
  questions: FourQuestQuestions;
}

interface QuestQuestion {
  questionId: string;
  conceptIds: string[];
  cognitiveOperation: CognitiveOperation;
  prompt: string;
  options: [QuestionOption, QuestionOption, QuestionOption, QuestionOption];
  correctOptionId: string;
  answerExplanation: string;
  evidence: SourceEvidence[];
}

interface QuestionOption {
  optionId: string;
  text: string;
}

interface GroundedTakeaway {
  takeawayId: string;
  text: string;
  conceptIds: string[];
  evidence: SourceEvidence[];
}

interface SourceEvidence {
  segmentId: string;
  excerpt: string;
}
```

Tuple aliases enforce exactly five concepts, three stages, four questions per
stage, four total rematches, and three takeaways. The JSON Schema sets
`additionalProperties: false` recursively and bounds every string and array.
Evidence arrays contain one or two references. Concept-reference arrays contain
one to three unique IDs.

Contract invariants:

- `requestedDifficulty` must equal the application request.
- `sourceTitle` must equal the application's sanitized request title; fixture
  titles must equal the registered demo-source title.
- Priority concepts appear from highest to lowest learning priority.
- The model emits no priority number. The application maps array positions to
  `critical`, `high`, `medium`, `low`, `baseline`, displayed as 100–20 if needed.
- Stages appear exactly once in foundation, connection, synthesis order.
- IDs are unique and match stable prefixes: `concept-`, `stage-`, `question-`,
  `option-`, and `takeaway-`.
- Every reference resolves within the same quest.
- Every question has four non-empty, case-insensitively distinct options and one
  correct option.
- Main and rematch prompts must not be exact or normalized duplicates. A simple
  token-overlap warning flags likely semantic duplicates for evaluation.
- Locators must exist and excerpts must be normalized substrings of the named
  source segment.
- The contract rejects health, damage, hearts, score, streak, animation, enemy,
  theme, asset, timing, or any other runtime-mechanics field.

### Difficulty matrix

The selected difficulty never changes between stages. Cognitive focus advances
the educational purpose:

| Stage focus | Easy                                                                             | Medium                                                                | Hard                                                                                      |
| ----------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Foundation  | Recognize or recall an explicit core idea using clearly distinguishable options. | Explain a core idea or distinguish closely related terms.             | Discriminate nuanced definitions, qualifications, assumptions, or edge cases.             |
| Connection  | Identify a direct relationship, sequence, or simple cause and effect.            | Combine two concepts or reason through a bounded causal relationship. | Integrate multiple concepts or diagnose a plausible misconception.                        |
| Synthesis   | Apply one principle in a familiar, directly supported scenario.                  | Perform a bounded multi-step application or inference.                | Transfer or evaluate concepts in an unfamiliar scenario with competing plausible options. |

Allowed operations by cell:

| Focus      | Easy                  | Medium                     | Hard                      |
| ---------- | --------------------- | -------------------------- | ------------------------- |
| Foundation | `recognize`, `recall` | `explain`, `differentiate` | `discriminate`, `qualify` |
| Connection | `relate`, `sequence`  | `cause_effect`, `combine`  | `integrate`, `diagnose`   |
| Synthesis  | `apply_familiar`      | `apply_multistep`, `infer` | `transfer`, `evaluate`    |

Application validation enforces the requested difficulty, stage order, and
allowed operation. Manual evaluation confirms the prompt actually exhibits the
declared cognition.

## 4. Source grounding and OpenAI boundary

### Segmentation and provenance

Treat pasted material as untrusted data, never as instructions.

1. Normalize CRLF to LF and trim outer whitespace without rewriting content.
2. Split on paragraph boundaries, then sentence boundaries for oversized
   paragraphs; hard-split only when a single sentence exceeds the segment cap.
3. Produce ordered, stable locators `S001`, `S002`, and so on, each no longer
   than 1,500 characters.
4. Send only these labeled segments to the provider.
5. Validate each returned locator against the request's segment map.
6. Normalize whitespace for comparison and require every excerpt to be a
   contiguous substring of the referenced segment.
7. Reject the complete generation if any evidence check fails.

The prompt states that source text may contain instructions and that those
instructions must be ignored. The model receives no tools, web search, file
search, previous response, production data, or outside context.

### Provider boundary

```ts
interface QuestProvider {
  generate(input: QuestProviderInput): Promise<unknown>;
  repair(input: QuestRepairInput): Promise<unknown>;
}
```

- `FixtureQuestProvider` selects one of three checked _Science of Learning_
  quests by requested difficulty and is the default for local, CI, public
  fallback, and judge reliability. Fixture output is validated at startup/test
  through the same schema and provenance path as live output.
- `OpenAIQuestProvider` performs the live Responses API call.
- `QuestService` validates input, segments the source, invokes a provider,
  validates schema and provenance, permits one repair, and returns a typed safe
  result. Components and routes never call the SDK directly.

OpenAI request defaults:

- model: `gpt-5.6-sol`, configurable by server-only environment variable;
- reasoning effort: `low`;
- strict Structured Outputs via `text.format` and the repository JSON Schema;
- `store: false`;
- maximum output: 14,000 tokens;
- total application timeout: 45 seconds;
- SDK transport retries: zero;
- no tools and no previous response chain.

The prompt requires only source-supported educational content and explicit
uncertainty rather than invention. A refusal, incomplete response, timeout,
schema failure, or provenance failure is not parsed as a quest.

### Single repair protocol

One completed but invalid response may receive one repair request containing:

- safe validation codes;
- affected generated IDs;
- affected field paths and sanitized fragments;
- only the source segments required for those fields;
- the required JSON Schema.

Allowed codes are `SCHEMA_INVALID`, `LOCATOR_UNKNOWN`, `EXCERPT_MISMATCH`,
`OPTION_INVALID`, `REFERENCE_INVALID`, `IDENTIFIER_DUPLICATE`,
`CONTENT_DUPLICATE`, and `DIFFICULTY_RULE_MISMATCH`.

Do not include stack traces, secrets, unrelated source segments, complete raw
logs, or unrelated generated content. Do not repair network errors, timeouts,
429s, refusals, or 5xx responses. A second invalid output fails closed with
`GENERATION_INVALID` and offers Demo mode.

## 5. Deterministic game system

### Runtime ownership

`QuestRuntimeConfig` is application-owned and keyed by cognitive focus. Each
entry fixes the stage theme, enemy identity, 100 maximum health, animation IDs,
and accessible labels. P0 stage identities are:

| Focus      | Theme                | Enemy              |
| ---------- | -------------------- | ------------------ |
| Foundation | Foundation Grove     | Recall Wraith      |
| Connection | Connection Cavern    | Linkbreaker        |
| Synthesis  | Citadel of Synthesis | Synthesis Sentinel |

Generated `educationalMisconception` is displayed as the boss's mistaken belief
but cannot change its identity or behavior.

```ts
const QUEST_COMBAT = {
  enemyMaxHealth: 100,
  baseCorrectDamage: 34,
  secondConsecutiveBonus: 5,
  thirdAndLaterConsecutiveBonus: 10,
  startingHearts: 5,
  correctScore: 100,
  secondStreakScoreBonus: 25,
  thirdAndLaterStreakScoreBonus: 50,
  hintPenalty: 25,
} as const;
```

- A correct answer deals 34 damage plus a 5-point second-answer or 10-point
  third-and-later consecutive bonus.
- Three consecutive correct answers deal `34 + 39 + 44 = 117` damage.
- Any three correct answers among four deal at least `34 + 34 + 39 = 107`.
- A wrong answer deals no damage, resets the streak, removes one heart, and
  scores zero.
- A used hint reduces that question's score by 25 but cannot make it negative.
- A stage ends on zero enemy health, zero hearts, or exhaustion of four main
  questions. If health remains, the stage is visibly failed and can be retried
  from its initial deterministic state.
- Questions become immutable after submission; repeated clicks cannot score or
  damage twice.

### Reducer state machine

Use one discriminated-union reducer state with these screens:

```text
setup -> generating -> priority-focus -> battle
battle -> answer-feedback -> battle | stage-result
stage-result -> battle | results
results -> rematch -> results
any async boundary -> safe-error -> setup | deterministic-demo
```

Reducer actions contain identifiers and learner choices, never calculated
damage or score. Pure reducer helpers calculate transitions from the current
state, question, and runtime configuration. Invalid or stale actions return the
unchanged state. No component mutates quest or combat objects.

Mastery per concept is deterministic:

```text
mastery = correct tagged answers / answered tagged questions
```

Unanswered concepts sort last. Rematches sort first by ascending mastery, then
descending number wrong, then Priority Focus order, then question ID. This
ordering is stable and independently tested.

Exhaustively test all 16 correct/incorrect patterns for a four-question stage,
including health, streak, hearts, score, early victory, terminal state, and
duplicate-submission resistance.

## 6. Experience and accessibility

Build the visual system with original inline SVG, CSS gradients, and CSS
animations. Do not add generated raster assets or copyrighted game art.

- Use the three fixed stage environments above with a consistent parchment,
  emerald, sky, gold, coral, and violet palette.
- Animation IDs cover idle, correct hit, wrong shake, damage burst, stage entry,
  and victory dissolve. CSS owns their implementation.
- `prefers-reduced-motion: reduce` removes movement and substitutes immediate
  opacity/state changes.
- Never communicate correctness, health, difficulty, or mode by color alone.

Accessibility acceptance:

- semantic headings, fieldsets, legends, buttons, progress elements, and lists;
- every input and mode control has a visible label;
- option selection and submission work with keyboard alone;
- focus moves to the answer explanation after submission and to the next stage
  heading after transition;
- an appropriately scoped `aria-live` region announces damage, remaining enemy
  health, heart loss, and stage outcome without repeating the whole page;
- visible focus indicators and WCAG AA text contrast;
- no timer, hover-only information, forced animation, or audio dependency;
- mobile layouts work at 320 CSS pixels without horizontal page scrolling.

## 7. Privacy, abuse, and release controls

Before live generation, display and require acknowledgment of:

> Live AI mode sends the material you provide to OpenAI to generate your quest.
> Cumulore Quest does not persist your material in this hackathon build. OpenAI
> may process or retain data according to the applicable OpenAI policies. Choose
> Demo mode if you do not want to send material for live generation.

Required controls:

- show a persistent `Live AI` or `Deterministic Demo` badge;
- do not persist submitted text in a database, file, cache, browser storage,
  analytics event, URL, log, fixture, or error;
- keep the API key and model setting server-side;
- redact prompts, filenames, source text, excerpts, user identifiers, and raw
  upstream failures from logs;
- log only timestamp, operation, mode, safe request ID, duration bucket,
  outcome, safe error code, and numeric token usage when available;
- disable submit while active and reuse one browser-side promise for repeated
  clicks with the same request ID;
- reject duplicate completed submissions in client state and never apply the
  returned quest twice;
- return 429 safely, honor a bounded `Retry-After` display, and do not retry it;
- offer Demo mode after timeout, network, 429, 5xx, refusal, or validation
  failure rather than silently relabeling a fixture as live.

Live public generation is a release gate. It may be enabled only when both are
true:

1. a dedicated OpenAI project has usage alerts and a verified hard boundary
   that blocks additional spend; and
2. the deployment is judge-access-protected **or** has enforceable platform-side
   request and token rate limits.

An alert-only budget is insufficient. If either requirement lacks evidence,
the public deployment remains fixture-first. Demonstrate live generation in the
video or a controlled judge deployment; never expose an unrestricted paid
endpoint.

Environment contract:

| Variable                        | Safe default                               |
| ------------------------------- | ------------------------------------------ |
| `QUEST_PROVIDER`                | `fixture`                                  |
| `QUEST_LIVE_GENERATION_ENABLED` | `false`                                    |
| `OPENAI_API_KEY`                | absent; required only when live is enabled |
| `OPENAI_QUEST_MODEL`            | `gpt-5.6-sol`                              |
| `OPENAI_QUEST_REASONING_EFFORT` | `low`                                      |
| `OPENAI_QUEST_TIMEOUT_MS`       | `45000`                                    |
| `QUEST_SOURCE_MAX_CHARS`        | `20000`                                    |
| `QUEST_OUTPUT_MAX_TOKENS`       | `14000`                                    |

Environment validation must fail the server build/start when live mode is true
without its key or when numeric bounds are invalid. Fixture builds require no
credential.

## 8. Evaluation and quality gates

Use three checked, repository-authored evaluation sources so the suite covers
different subject structures without copyright ambiguity:

1. learning science: retrieval practice, spacing, and interleaving;
2. HTTP request lifecycle: client, DNS, connection, request, and response;
3. photosynthesis and respiration: energy transformation and relationships.

Run all three sources at all three difficulties: nine generations and 144 total
questions (108 main plus 36 rematch).

Automate across all 144 questions:

- JSON Schema and supported schema version;
- exact five-concept, three-stage, twelve-main, four-rematch counts;
- unique IDs and resolvable references;
- locator existence and normalized excerpt containment;
- four distinct options and exactly one correct option;
- requested difficulty and cognitive-operation matrix compliance;
- exact and normalized duplication detection plus a token-overlap warning;
- absence of game-mechanics fields;
- safe rejection of malformed, refused, incomplete, and unsupported output.

Manually review exactly 45 questions: five from every generation, comprising one
from each stage, one rematch, and one additional stage question rotated evenly
across the matrix. Each sampled question must pass every criterion:

- answer and explanation are directly supported by cited evidence;
- distractors are plausible but unambiguously wrong from that source;
- explanation teaches rather than restates;
- difficulty and cognitive purpose match the matrix;
- no outside knowledge is needed;
- wording is clear, non-duplicative, and safe.

Any failure requires a prompt/validator correction and a complete nine-run
rerun. Manually verify every question visible in the final recorded judge demo,
even if it was not selected in the 45-question sample.

## 9. Five reviewable implementation slices

Complete and review each slice before starting the next. Do not absorb later
work into an earlier diff.

### Q1 — Documentation, schema, and deterministic vertical slice

- Preserve this file as the sole hackathon plan source of truth; do not change
  the active production milestone.
- Add educational contract, valid/invalid fixtures, runtime types, fixed stage
  configuration, fixture provider, reducer, and minimum page.
- Complete one fixture stage from Priority Focus through answer evidence and
  stage result, then extend the same path to all three stages.
- Add exact count, forbidden-mechanics, priority-band, reducer, and exhaustive
  combat tests.

**Accept when:** fixture mode completes three stages and rematch without network
or credentials; all 16 combat patterns pass; schema rejects mechanics; build,
typecheck, lint, and tests pass. No OpenAI dependency or route exists yet.

### Q2 — Source, provenance, and difficulty validation

- Implement deterministic segmentation, locator/excerpt validation, reference
  integrity, difficulty matrix, duplicate checks, and safe validation codes.
- Route the checked fixture through the same validation path live output will
  use.
- Add the three evaluation source fixtures and invalid contract cases.

**Accept when:** unknown locators, mismatched excerpts, invalid references,
wrong difficulty operations, duplicate IDs/options/questions, extra fields, and
unsupported versions all fail closed; valid fixtures pass deterministically.

### Q3 — OpenAI provider and protected API boundary

- Run the SDK discovery/type-verification procedure before pinning a version.
- Implement provider, QuestService, thin POST route, strict Structured Outputs,
  `store: false`, zero transport retry, timeout, and one sanitized repair.
- Add disclosure, mode labels, environment validation, source/body limits,
  repeated-click protection, and typed failure mapping.

**Accept when:** credential-free fixture build passes; provider tests cover
success, refusal, timeout, 429, 5xx, invalid output, valid repair, failed repair,
and redaction; no paid call is reachable when live is disabled.

### Q4 — Complete UX, accessibility, and visual polish

- Complete setup, focus, battle, feedback, results, and rematch states.
- Add original SVG/CSS environments and reduced-motion behavior.
- Perform keyboard, focus, screen-reader, contrast, mobile, and error-recovery
  checks against both modes.

**Accept when:** a new user can finish the deterministic demo without guidance;
all important state is perceivable without color or motion; 320-pixel layout,
keyboard path, focus transitions, and failure-to-demo recovery pass review.

### Q5 — Evaluation, deployment, and submission

- Run the nine-generation automated matrix and 45-question manual review.
- Verify every final-demo question, capture screenshots, record the demo, and
  update README setup/sample-data/Codex collaboration notes.
- Deploy fixture-first. Enable public live mode only with documented release-
  gate evidence.

**Accept when:** all automated and manual gates pass, production build is clean,
fixture mode is credential-free, public cost posture is safe, deployment smoke
passes, and the submission materials clearly distinguish pre-existing Cumulore
from the Build Week delta.

## 10. Seventy-two-hour execution schedule

### Hours 0–24 — reliable vertical slice

- 0–2: confirm clean branch, preserve this plan, create module skeleton.
- 2–7: implement JSON Schema, TS types, valid/invalid fixture, and validator.
- 7–12: implement runtime configuration, combat, reducer, and exhaustive tests.
- 12–18: build setup, Priority Focus, first battle, feedback, and evidence card.
- 18–22: extend fixture to all stages, results, mastery, and rematch.
- 22–24: run Q1 checks and review the diff; fix before continuing.

### Hours 24–48 — grounding and live generation

- 24–29: segmentation, provenance, difficulty, duplicate, and reference checks.
- 29–32: finish Q2 tests and review gate.
- 32–34: query SDK version, inspect types, compile request probe, pin dependency.
- 34–40: provider, QuestService, strict response, timeout, and sanitized repair.
- 40–44: API route, disclosure, mode state, environment and abuse controls.
- 44–48: provider/route failure tests and Q3 review. Disable live if unstable.

### Hours 48–72 — experience, evidence, and submission

- 48–55: stage visuals, transitions, responsive layout, and reduced motion.
- 55–59: accessibility and failure-recovery pass; complete Q4 review.
- 59–64: run nine-generation eval, fix failures, rerun the complete matrix.
- 64–67: complete 45-question and final-demo manual reviews.
- 67–69: production build, full verification, deployment, and smoke test.
- 69–71: screenshots and public YouTube video under three minutes with audio.
- 71–72: README/submission proofread, Codex session feedback ID, final backup.

Freeze new features at hour 48. At hour 60, default the deployment to fixture
mode unless live generation and its release controls are already green.

## 11. Commands and CI

Add focused scripts without weakening existing repository verification:

```text
pnpm --filter @cumulore/web test:quest
pnpm quest:eval -- --provider=fixture
pnpm quest:eval -- --provider=live
```

The fixture evaluation validates all three checked demo difficulties. The live
evaluation command runs the three-source by three-difficulty matrix and requires
an explicit provider flag, live-enabled environment, and API key; it must never
run in ordinary CI. CI uses the fixture provider and no OpenAI secret.

Run at every slice boundary:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm --filter @cumulore/schemas test
pnpm --filter @cumulore/web test:quest
pnpm build:production
git diff --check
```

Run before submission:

```bash
pnpm install --frozen-lockfile
pnpm verify
pnpm quest:eval -- --provider=fixture
pnpm build:production
git diff --check
git status --short
```

Also run the nine live cases in the controlled environment, record only safe
aggregate results, and manually complete the evaluation rubric. Do not commit
raw source submissions, raw model responses, secrets, usage exports, local
timing output, or judge credentials.

## 12. Demo and submission plan

### Three-minute video

- 0:00–0:15 — learning friction and the Cumulore Quest promise.
- 0:15–0:35 — choose material/mode and one quest-wide difficulty; show disclosure.
- 0:35–0:55 — Priority Focus explains the five ranked learning targets.
- 0:55–1:45 — answer across all three conceptual stages; show damage, evidence,
  and a misconception correction.
- 1:45–2:10 — show mastery results and weak-topic rematch.
- 2:10–2:35 — show the educational-only structured contract, deterministic
  reducer, provenance validation, and safe fixture fallback.
- 2:35–2:50 — show Codex collaboration and the Build Week implementation delta.
- 2:50–3:00 — impact statement and deployed URL.

Capture: setup/mode disclosure, Priority Focus, each stage, evidence card,
results/rematch, reduced-motion or keyboard state, and a safe fallback state.

Submission readiness also requires:

- a public YouTube video under three minutes with audible narration;
- deployed URL and repository URL;
- private-repository judge access for the required event accounts, or a public
  repository if intentionally approved later;
- README setup, environment variables, fixture mode, sample data, architecture,
  safety controls, tests, Codex collaboration, and dated Build Week delta;
- the required Codex `/feedback` session ID;
- project description rewritten in the submitter's own voice.

## 13. Final acceptance standard

Cumulore Quest is ready to submit only when:

- P0 works from a clean, credential-free install in deterministic mode;
- live mode, when enabled, uses a verified compatible pinned SDK, strict
  Structured Outputs, `store: false`, bounded input/output/time, and no tools;
- model content cannot control combat, scoring, health, hearts, visuals, or
  animations;
- the selected difficulty applies to all three cognitive stages;
- every displayed educational claim has validated source evidence;
- malformed or insufficient evidence fails visibly rather than inventing;
- repeated actions cannot duplicate combat effects or paid requests in the UI;
- all automated tests, nine evaluation runs, 45 manual checks, and every demo
  question pass;
- accessibility and mobile acceptance checks pass;
- no submitted material, credential, private identifier, or raw provider output
  is persisted or logged;
- public live generation satisfies the cost gate, otherwise the deployment is
  fixture-first;
- the implementation remains isolated from the active production milestone.
