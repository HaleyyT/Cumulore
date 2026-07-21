# Cumulore

Cumulore is a source-grounded, self-updating learning workspace. The repository
currently contains the private-alpha identity, tenancy, durable-processing, and
first-ingestion foundations; the active milestone hardens their operational
and performance evidence before more product capability is added.

## Start here

- Product vision: [`docs/PRODUCT_BLUEPRINT.md`](docs/PRODUCT_BLUEPRINT.md)
- Private-alpha scope: [`docs/MVP_SCOPE.md`](docs/MVP_SCOPE.md)
- Technical plan: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- Delivery sequence: [`docs/ROADMAP.md`](docs/ROADMAP.md)
- Active implementation contract: [`specs/current-milestone.md`](specs/current-milestone.md)
- Repository rules: [`AGENTS.md`](AGENTS.md)

Architecture decisions are recorded in [`docs/decisions/`](docs/decisions/).
Personal notes, temporary Codex transcripts, abandoned ideas, and scratch output
belong under `.local/`, which is ignored. Credentials belong in `.env.local` for
local development or in the deployment platform's secret manager, never in
Markdown.

For local setup, quality commands, dependency policy, infrastructure health
checks, and logging conventions, see [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md).
Operational recovery and performance evidence are documented in
[`docs/OPERATIONS.md`](docs/OPERATIONS.md) and
[`docs/PERFORMANCE.md`](docs/PERFORMANCE.md); current trust boundaries are in
[`docs/SECURITY.md`](docs/SECURITY.md).

## Cumulore Quest Build Week demo

The temporary **Cumulore Quest** demo is isolated on the
`hackathon/openai-build-week-cumulore-quest` branch. Start it with
`pnpm --filter @cumulore/web exec next dev`; it defaults to the credential-free
**Deterministic Demo**. Run `pnpm quest:eval -- --provider=fixture` to check
the three checked source fixtures and every demo difficulty. Live AI remains off
unless explicitly enabled with server-only environment configuration; a
controlled live matrix additionally requires `QUEST_PROVIDER=openai`,
`QUEST_LIVE_GENERATION_ENABLED=true`, and an uncommitted `OPENAI_API_KEY`.
Never run it in ordinary CI or commit an API key.
The accepted Build Week plan and status are in
[`docs/build-week/hackathon-plan.md`](docs/build-week/hackathon-plan.md) and
[`hackathon-progress.md`](hackathon-progress.md). See the
[Build Week release checklist](docs/build-week/release-checklist.md) before
enabling Live AI anywhere public. Safe aggregate evaluation status and the
manual-review protocol are tracked in
[`docs/build-week/evaluation-evidence.md`](docs/build-week/evaluation-evidence.md).
Deployment configuration and safe smoke checks are in the
[Vercel Live AI runbook](docs/build-week/vercel-live-ai.md).
The time-boxed submission materials, video script, and judge handoff are indexed
in the [Build Week submission pack](docs/build-week/README.md).

### How Codex and GPT-5.6 were used

Codex was used throughout the Build Week branch as an engineering collaborator,
not as a one-shot code generator. GPT-5.6 Codex sessions helped turn the
hackathon concept into bounded implementation slices, review the generated
contract and difficulty semantics, implement the fixture and protected live
paths, add adversarial tests, diagnose deployment failures, and verify the
release boundary. The primary session ID is intentionally not stored in the
repository; it must be retrieved with `/feedback` and entered directly into the
Devpost form.

The human-owned decisions include the **Cumulore Quest** name, the Education
track and learner problem, the `content teaches; code plays` boundary, the
fixture-first public experience, and final acceptance of every slice. Codex
accelerated code inspection, implementation, test design, and consistency
review; each change was inspected and exercised before it was accepted.

Live quest generation separately uses GPT-5.6 Terra through the OpenAI
Responses API. The request is server-only, uses Structured Outputs and
`store: false`, and is accepted only after deterministic schema, source,
provenance, duplicate, and difficulty checks. The game engine calculates
health, damage, scoring, stages, and rematches itself; model output cannot alter
those mechanics. The credential-free fixture follows the same validated
contract and remains the reliable judge fallback.

### Current progress — 94%

| Build Week slice              | Status      | Delivered outcome                                                                                                                          |
| ----------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Q1 — deterministic foundation | Complete    | A complete, credential-free learning quest with application-owned combat and rematches.                                                    |
| Q2 — source grounding         | Complete    | Segmentation, evidence, duplicate, difficulty, reference, and requested-source validation fail closed.                                     |
| Q3 — protected Live AI        | Complete    | A guarded server-only OpenAI boundary with strict outputs, one repair, safe errors, and recoverable setup.                                 |
| Q4 — experience polish        | Complete    | Responsive visual experience, reduced-motion support, keyboard controls, focus management, and result/rematch states.                      |
| Q5 — release evidence         | In progress | Fixture evaluation and safe evidence recording are ready; controlled live evaluation, manual review, deployment, and cost evidence remain. |

### System design choices

| Choice                               | Why it matters                                                                                                                      |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Content teaches; code plays**      | Provider output can supply educational questions and evidence, but never health, score, hearts, timing, or animation behavior.      |
| **Fixture-first by default**         | The public and CI experience works without a key, network access, or paid model call.                                               |
| **Server-only Live AI boundary**     | OpenAI configuration and source submission stay behind the POST route; the browser never receives credentials.                      |
| **Fail closed, then recover safely** | Invalid provenance, schema, or runtime content is rejected. A failed live attempt leaves the learner able to retry or use the demo. |
| **Evidence stays with every claim**  | Every displayed answer explanation is linked to validated source excerpts.                                                          |

### Repository structure

| Path                                             | Purpose                                                                              |
| ------------------------------------------------ | ------------------------------------------------------------------------------------ |
| [`apps/web/`](apps/web/)                         | Next.js Quest interface, API route, live-provider adapter, and focused tests.        |
| [`packages/schemas/`](packages/schemas/)         | Versioned JSON Schema contracts and valid/invalid fixtures.                          |
| [`docs/build-week/`](docs/build-week/)           | Accepted plan, release gate, and safe evaluation evidence.                           |
| [`hackathon-progress.md`](hackathon-progress.md) | Plain-language implementation progress and percentage.                               |
| [`docs/`](docs/)                                 | Production Cumulore architecture, security, operations, and milestone documentation. |

### Run and verify

```bash
pnpm install --frozen-lockfile
pnpm --filter @cumulore/web exec next dev
pnpm quest:eval -- --provider=fixture
pnpm --filter @cumulore/web test:quest
pnpm build:production
```

The fixture command is safe for local development and CI. The controlled live
matrix is deliberately separate: it needs `QUEST_PROVIDER=openai`,
`QUEST_LIVE_GENERATION_ENABLED=true`, and an uncommitted `OPENAI_API_KEY`.
Do not enable it publicly until every item in the
[Build Week release checklist](docs/build-week/release-checklist.md) is evidenced.

### Generate a quest from your own material

The deployed demo in the screenshot is intentionally in **Deterministic Demo**
mode, so its Live AI button cannot make a provider call. To generate a grounded
quest locally, copy `.env.example` to ignored `.env.local`, then set only these
three values in `.env.local`:

```bash
QUEST_PROVIDER=openai
QUEST_LIVE_GENERATION_ENABLED=true
OPENAI_API_KEY=<real key from a dedicated OpenAI project>
```

Restart `pnpm --filter @cumulore/web exec next dev`. Open **Try Live AI with
your own material**, paste 100-10,000 characters or load a `.txt` file, choose
the chamber intensity, optionally state a learning goal, acknowledge the data
transfer, then select **Generate live quest**. The result is checked against
the versioned contract and source excerpts before it can enter the quiz. After
the run, the results screen shows source-grounded review notes and a targeted
rematch. Never commit `.env.local` or enable these settings on a public
deployment until the release checklist is complete.

For Vercel, add all three variables to the same environment scope as the
deployment, then redeploy. Adding only `OPENAI_API_KEY` deliberately leaves
Live AI off. A literal value such as `your_actual_OpenAI_API_key` is a
placeholder, not a usable credential. Follow the
[Vercel Live AI runbook](docs/build-week/vercel-live-ai.md) for the exact
configuration, protection, and verification sequence.
