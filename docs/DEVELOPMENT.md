# Development foundation

## Setup and verification

Use Node.js 22.22.2+, pnpm 11.7.0+, Python 3.13+, and Docker Compose v2. From a clean checkout:

```sh
pnpm install --frozen-lockfile
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --require-hashes -r requirements-dev.lock
python -m pip install --no-deps --no-build-isolation .
cp .env.example .env.local
pnpm verify
docker compose up -d
docker compose ps
docker compose exec postgres psql -U cumulore -d cumulore -c "CREATE EXTENSION IF NOT EXISTS vector; CREATE EXTENSION IF NOT EXISTS pg_stat_statements; SELECT extname FROM pg_extension WHERE extname IN ('vector', 'pg_stat_statements') ORDER BY extname;"
DATABASE_URL=postgresql://cumulore:cumulore_local_only@localhost:${POSTGRES_PORT:-5432}/cumulore pnpm db:migrate
DATABASE_URL=postgresql://cumulore:cumulore_local_only@localhost:${POSTGRES_PORT:-5432}/cumulore pnpm test:integration
```

For the authoritative clean-room path, Docker must be running but Compose does
not need to be started:

```sh
pnpm test:integration:isolated
```

This one command starts a randomly port-mapped pinned PostgreSQL/pgvector
container, enables pgvector and local-only query statistics, migrates from
zero, runs every TypeScript and Python integration suite plus worker smoke, and
always destroys the container. CI executes the same command.

`docker compose ps` reports both services healthy. PostgreSQL, the MinIO
S3-compatible endpoint at `S3_ENDPOINT`, and the MinIO console at
`http://localhost:9001` are published on `127.0.0.1` only; no production
provider or credentials are involved. Stop services with
`docker compose down`.

If port 5432 is already occupied, run
`POSTGRES_PORT=5433 docker compose up -d` and use port 5433 in local database
clients. Host-port overrides change only the loopback port and remain bound to
`127.0.0.1`.

Root commands are `format`, `format:check`, `lint`, `typecheck`, `test`,
`contracts`, `docs:check`, `secrets:check`, `env:check`, `python:lint`,
`python:typecheck`, `python:test`, `python:test:integration`, `db:migrate`,
`test:integration:tenancy`, `test:integration:durable-schema`,
`test:integration:durable-dispatch-claim`, `test:integration:durable-transitions`,
`test:integration:durable-idempotency`, `test:integration:durable`,
`test:integration:ingestion`, `test:integration:operational`,
`test:integration`, `test:integration:isolated`, `perf:baseline`, `worker:smoke`,
and `verify`. `contracts` validates the same deterministic JSON fixtures with
Ajv in TypeScript and `jsonschema` in Python. Contracts are in
`packages/schemas/contracts`; fixtures are in `packages/schemas/fixtures`;
incompatible changes need a new versioned filename.

Milestone 1C database functions are applied by migrations and exercised by the
Slice 1C.5 worker runtime and integration tests. The web-side synthetic
producer accepts an existing actor transaction, so the
synthetic operation and validated outbox event commit or roll back together.
Only `cumulore_worker` may execute the bounded cross-workspace dispatch and
claim functions; neither function performs handler work or external calls.
Slice 1C.3 transition functions require a transaction-local workspace for
worker calls, exact lease fencing, and active membership for web calls. They
record safe action history and never accept source content or provider calls.
Slice 1C.4 stores only canonical, bounded, non-sensitive command responses;
the fake provider is deterministic and has no network or production-provider
dependency.
Slice 1C.5 exposes `dispatcher`, `executor`, `maintenance`, and `all` worker
roles through `python -m cumulore_worker ...`; `--once` is the deterministic
single-role mode. `pnpm worker:smoke` creates a synthetic operation, dispatches
and executes database-effect, confirmed external success,
unknown-then-reconciled success, retryable failure, and non-retryable failure
through separately started roles. The runtime uses separate PostgreSQL
transactions for claim, provider preparation, invocation, result persistence,
and fenced completion; no transaction remains open during invocation. It
validates the migration-owned handler registry, renews 60-second leases every
20 seconds, and permits 45 seconds for graceful shutdown. Maintenance performs
bounded reclaim, stale external-operation recovery, cross-workspace
reconciliation through a narrow migration-owned function, and retention
cleanup. The provider remains a deterministic, process-independent fake with
no network or production-provider dependency.

Milestone 2A provides workspace-scoped PDF/TXT/pasted-text upload sessions with
immutable quarantine keys, finalize events, exact hash duplicate detection,
and deterministic normalized extraction. `LocalQuarantineStorage` is test and
development-only; production wiring must select a private S3-compatible
adapter before non-local ingestion is enabled. Unsupported, malformed, empty,
or over-sized content reaches an actionable failure rather than an empty
success.

Milestone 2B extends the same contract to DOCX and PPTX. The deterministic
worker reader preserves headings, paragraphs, tables, and slide/page locators,
and rejects malformed, encrypted, oversized, or empty Office Open XML files
with safe actionable errors. See `specs/milestone-2b-remaining-ingestion-formats.md`.

Milestone 3 creates heading-aware source chunks,
materializes direct or descendant folder scopes, and performs PostgreSQL
full-text search with source-version and locator provenance. A no-match query
returns `insufficient_evidence`; deterministic reranking and a grounded-answer
contract now operate on authorized results. Claim support scoring and a
versioned review proposal preserve provenance without publication, while model calls remain deferred
pending their privacy, cost, and evaluation gate.

Milestone 2A-H adds the development-only isolated PostgreSQL harness, bounded
upload/origin checks, aggregate operational metrics, redacted structured logs,
and the synthetic performance command. See `docs/SECURITY.md`,
`docs/PERFORMANCE.md`, and `docs/OPERATIONS.md`. Machine-specific performance
output belongs under ignored `.local/`; it is never a committed benchmark.

Local and CI use `IDENTITY_PROVIDER=fake`, which requires no network access. Set `IDENTITY_PROVIDER=auth0` only in a deployed secret environment with the official Auth0 SDK configuration, including `AUTH0_ISSUER_BASE_URL`; do not commit those values. The application owns internal user IDs and workspace authorization; Auth0 issuer plus subject identifies an external identity, while email remains mutable profile data.

## Dependency policy

| Dependency                                                                  | License               | Maintenance | Purpose and justification                                                                                                                                |
| --------------------------------------------------------------------------- | --------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ajv 8.20.0 / ajv-formats 3.0.1                                              | MIT                   | Active      | Production TypeScript validation of immutable JSON Schema Draft 2020-12 event contracts.                                                                 |
| TypeScript 5.9.3                                                            | Apache-2.0            | Active      | Strict TypeScript checking.                                                                                                                              |
| ESLint 9.39.1 / typescript-eslint 8.46.3                                    | MIT                   | Active      | TypeScript lint baseline.                                                                                                                                |
| Prettier 3.6.2                                                              | MIT                   | Active      | Deterministic formatting.                                                                                                                                |
| tsx 4.20.6                                                                  | MIT                   | Active      | Runs the small TypeScript contract test without a build system.                                                                                          |
| jsonschema 4.25.1                                                           | MIT                   | Active      | Draft 2020-12 validation in Python.                                                                                                                      |
| pypdf 6.14.2                                                                | BSD-3-Clause          | Active      | Production PDF page parsing with real page boundaries; the previous regular-expression fixture parser could generate false citation pages.               |
| Ruff 0.14.3 / mypy 1.18.2 / pytest 9.0.3 / types-jsonschema 4.25.1.20251009 | MIT                   | Active      | Python linting, type checking, tests, and JSON Schema type stubs.                                                                                        |
| PostgreSQL pgvector image / MinIO image                                     | PostgreSQL / AGPL-3.0 | Active      | Local-only database/vector and S3-compatible interfaces.                                                                                                 |
| pg 8.22.0 / @types/pg 8.20.0                                                | MIT                   | Active      | PostgreSQL transactions, migrations, and typed tenancy repositories.                                                                                     |
| Next 16.2.10 / React 19.2.7                                                 | MIT                   | Active      | Supported server runtime for the public authentication boundary and credential-free production build.                                                    |
| @auth0/nextjs-auth0 4.25.0                                                  | MIT                   | Active      | Official Auth0-supported Next.js integration behind Cumulore's lazy, fail-closed adapter.                                                                |
| @testcontainers/postgresql 12.0.4                                           | MIT                   | Active      | Development-only lifecycle for an isolated pgvector database shared by local and CI integration commands; Compose alone cannot supply per-run isolation. |

No dependency here selects a production provider. Ajv, PostgreSQL access,
Next, React, and Auth0 are product runtime dependencies; the remaining tools
are development-only. Testcontainers' optional transitive native build scripts
are disabled because local Docker transport uses the JavaScript path. Pinned
versions make local and CI tooling repeatable; review updates for license and
maintenance status.

## Logging conventions

Use structured logs with a generated or propagated `correlation_id` for each request or future job. Log operation names, stable internal identifiers only when necessary, outcomes, durations, and safe error classes. Never log source content, prompts, model input/output, credentials, signed URLs, authorization tokens, cookies, request bodies, or unnecessary personal identifiers. Redaction is mandatory before any future telemetry backend is selected.

The current TypeScript and Python logging boundaries accept only explicitly
typed control fields. Metrics are numeric and low-cardinality. OpenTelemetry
SDKs, exporters, browser instrumentation, and a telemetry backend remain
deferred until the Milestone 6 staging gate.
