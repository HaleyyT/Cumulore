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

Root commands are `format`, `format:check`, `lint`, `typecheck`, `test`, `contracts`, `docs:check`, `secrets:check`, `env:check`, `python:lint`, `python:typecheck`, `python:test`, and `verify`. `contracts` validates the same deterministic JSON fixture with Ajv in TypeScript and `jsonschema` in Python. Contracts are in `packages/schemas/contracts`; fixtures are in `packages/schemas/fixtures`; incompatible changes need a new versioned filename.

## Dependency policy

| Dependency                                                                  | License               | Maintenance | Purpose and justification                                         |
| --------------------------------------------------------------------------- | --------------------- | ----------- | ----------------------------------------------------------------- |
| Ajv 8.17.1 / ajv-formats 3.0.1                                              | MIT                   | Active      | Strict JSON Schema Draft 2020-12 validation in TypeScript.        |
| TypeScript 5.9.3                                                            | Apache-2.0            | Active      | Strict TypeScript checking.                                       |
| ESLint 9.39.1 / typescript-eslint 8.46.3                                    | MIT                   | Active      | TypeScript lint baseline.                                         |
| Prettier 3.6.2                                                              | MIT                   | Active      | Deterministic formatting.                                         |
| tsx 4.20.6                                                                  | MIT                   | Active      | Runs the small TypeScript contract test without a build system.   |
| jsonschema 4.25.1                                                           | MIT                   | Active      | Draft 2020-12 validation in Python.                               |
| Ruff 0.14.3 / mypy 1.18.2 / pytest 8.4.2 / types-jsonschema 4.25.1.20251009 | MIT                   | Active      | Python linting, type checking, tests, and JSON Schema type stubs. |
| PostgreSQL pgvector image / MinIO image                                     | PostgreSQL / AGPL-3.0 | Active      | Local-only database/vector and S3-compatible interfaces.          |

No dependency here is a production provider or product runtime dependency. Pinned versions make local and CI tooling repeatable; review updates for license and maintenance status.

## Logging conventions

Use structured logs with a generated or propagated `correlation_id` for each request or future job. Log operation names, stable internal identifiers only when necessary, outcomes, durations, and safe error classes. Never log source content, prompts, model input/output, credentials, signed URLs, authorization tokens, cookies, request bodies, or unnecessary personal identifiers. Redaction is mandatory before any future telemetry backend is selected.
