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
enabling Live AI anywhere public.
