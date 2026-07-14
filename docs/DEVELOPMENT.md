# Development foundation

## Setup and verification

Use Node.js 22.22.2+, pnpm 11.7.0+, Python 3.13+, and Docker Compose v2. From a clean checkout:

```sh
pnpm install --frozen-lockfile
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -e ".[dev]"
cp .env.example .env.local
pnpm verify
docker compose up -d
docker compose ps
docker compose exec postgres psql -U cumulore -d cumulore -c "CREATE EXTENSION IF NOT EXISTS vector; SELECT extname FROM pg_extension WHERE extname = 'vector';"
DATABASE_URL=postgresql://cumulore:cumulore_local_only@localhost:${POSTGRES_PORT:-5432}/cumulore pnpm db:migrate
DATABASE_URL=postgresql://cumulore:cumulore_local_only@localhost:${POSTGRES_PORT:-5432}/cumulore pnpm test:integration
```

`docker compose ps` reports both services healthy. PostgreSQL, the MinIO
S3-compatible endpoint at `S3_ENDPOINT`, and the MinIO console at
`http://localhost:9001` are published on `127.0.0.1` only; no production
provider or credentials are involved. Stop services with
`docker compose down`.

If port 5432 is already occupied, run
`POSTGRES_PORT=5433 docker compose up -d` and use port 5433 in local database
clients. Host-port overrides change only the loopback port and remain bound to
`127.0.0.1`.

Root commands are `format`, `format:check`, `lint`, `typecheck`, `test`, `contracts`, `docs:check`, `secrets:check`, `env:check`, `python:lint`, `python:typecheck`, `python:test`, `db:migrate`, `test:integration:tenancy`, `test:integration:durable-schema`, `test:integration:durable-dispatch-claim`, `test:integration:durable-transitions`, `test:integration:durable-idempotency`, `test:integration:durable`, `test:integration`, and `verify`. `contracts` validates the same deterministic JSON fixtures with Ajv in TypeScript and `jsonschema` in Python. Contracts are in `packages/schemas/contracts`; fixtures are in `packages/schemas/fixtures`; incompatible changes need a new versioned filename.

Milestone 1C database functions are applied by migrations and exercised only
through integration tests until the worker runtime arrives in Slice 1C.5. The
web-side synthetic producer accepts an existing actor transaction, so the
synthetic operation and validated outbox event commit or roll back together.
Only `cumulore_worker` may execute the bounded cross-workspace dispatch and
claim functions; neither function performs handler work or external calls.
Slice 1C.3 transition functions require a transaction-local workspace for
worker calls, exact lease fencing, and active membership for web calls. They
record safe action history and never accept source content or provider calls.
Slice 1C.4 stores only canonical, bounded, non-sensitive command responses;
the fake provider is deterministic and has no network or production-provider
dependency.

Local and CI use `IDENTITY_PROVIDER=fake`, which requires no network access. Set `IDENTITY_PROVIDER=auth0` only in a deployed secret environment with the official Auth0 SDK configuration, including `AUTH0_ISSUER_BASE_URL`; do not commit those values. The application owns internal user IDs and workspace authorization; Auth0 issuer plus subject identifies an external identity, while email remains mutable profile data.

## Dependency policy

| Dependency                                                                  | License               | Maintenance               | Purpose and justification                                                                                      |
| --------------------------------------------------------------------------- | --------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Ajv 8.17.1 / ajv-formats 3.0.1                                              | MIT                   | Active                    | Production TypeScript validation of immutable JSON Schema Draft 2020-12 event contracts.                       |
| TypeScript 5.9.3                                                            | Apache-2.0            | Active                    | Strict TypeScript checking.                                                                                    |
| ESLint 9.39.1 / typescript-eslint 8.46.3                                    | MIT                   | Active                    | TypeScript lint baseline.                                                                                      |
| Prettier 3.6.2                                                              | MIT                   | Active                    | Deterministic formatting.                                                                                      |
| tsx 4.20.6                                                                  | MIT                   | Active                    | Runs the small TypeScript contract test without a build system.                                                |
| jsonschema 4.25.1                                                           | MIT                   | Active                    | Draft 2020-12 validation in Python.                                                                            |
| Ruff 0.14.3 / mypy 1.18.2 / pytest 8.4.2 / types-jsonschema 4.25.1.20251009 | MIT                   | Active                    | Python linting, type checking, tests, and JSON Schema type stubs.                                              |
| PostgreSQL pgvector image / MinIO image                                     | PostgreSQL / AGPL-3.0 | Active                    | Local-only database/vector and S3-compatible interfaces.                                                       |
| pg 8.16.3 / @types/pg 8.15.5                                                | MIT                   | Active                    | PostgreSQL transactions, migrations, and typed tenancy repositories.                                           |
| Next 15.5.6 / React 19.1.1                                                  | MIT                   | Next 15.5.6 is deprecated | Minimal server runtime for the public authentication boundary; review the supported upgrade before production. |
| @auth0/nextjs-auth0 4.13.0                                                  | MIT                   | Active                    | Official Auth0-supported Next.js integration behind Cumulore's adapter.                                        |

No dependency here selects a production provider. Ajv, PostgreSQL access, Next, React, and Auth0 are product runtime dependencies; the remaining tools are development-only. Pinned versions make local and CI tooling repeatable; review updates for license and maintenance status.

## Logging conventions

Use structured logs with a generated or propagated `correlation_id` for each request or future job. Log operation names, stable internal identifiers only when necessary, outcomes, durations, and safe error classes. Never log source content, prompts, model input/output, credentials, signed URLs, authorization tokens, cookies, request bodies, or unnecessary personal identifiers. Redaction is mandatory before any future telemetry backend is selected.
