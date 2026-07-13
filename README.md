# Cumulore

Cumulore is a source-grounded, self-updating learning workspace. The repository
is currently in production-foundation planning; application code has not yet
started.

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
