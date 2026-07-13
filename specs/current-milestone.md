# Current Milestone: Milestone 1A — Repository Foundation

**Status:** Approved for implementation

**Approved:** 2026-07-13

## Goal

Create the smallest repeatable TypeScript and Python repository foundation
needed by later milestones without implementing product behaviour or selecting
external production providers prematurely.

## In scope

- Establish repository workspace and quality-tooling conventions.
- Define root commands for formatting, linting, type checking, unit tests,
  contract checks, and documentation checks.
- Configure strict TypeScript and typed Python quality baselines.
- Establish the location and compatibility rules for versioned,
  language-neutral contract schemas and cross-language fixtures.
- Define local-development interfaces for PostgreSQL with pgvector and
  S3-compatible object storage.
- Establish CI expectations, structured-log redaction rules, and correlation-ID
  conventions.
- Record every selected dependency's purpose, license, maintenance status, and
  justification before adding it.

## Out of scope

- Product domain behaviour, user interfaces, upload flows, extraction, search,
  generation, and artifact workflows.
- Identity, sessions, workspaces, memberships, folders, RLS policies, and
  runtime database roles; these begin in Milestone 1B.
- Outbox events, job tables, dispatch, workers, retries, and idempotency
  implementation; these begin in Milestone 1C.
- External identity, model, object-storage, telemetry, or production-hosting
  provider selection.
- Deployed infrastructure, production data, billing, or staging rollout.

## Readiness gates retained for later milestones

- ADR-0002 remains Proposed and must be reviewed and accepted before Milestone
  1B implementation.
- ADR-0003 remains Proposed and must be reviewed and accepted before Milestone
  1C implementation.
- OIDC selection is deferred to Milestone 1B.
- Deployed object-storage, malware-scanner, and upload-limit selections are
  deferred to Milestone 2A.
- Embedding and model providers are deferred to Milestone 3.
- Production hosting, region, telemetry backend, retention, and recovery policy
  are deferred until Milestone 6 before staging.

## Completion criteria

- Local setup and every documented root quality command are reproducible from a
  clean checkout.
- TypeScript and Python quality checks run through the agreed root interface.
- One language-neutral contract fixture validates consistently in TypeScript
  and Python without defining a product event prematurely.
- CI runs the same formatting, lint, type, test, contract, documentation, and
  secret checks used locally.
- Local PostgreSQL/pgvector and S3-compatible interfaces are documented and do
  not require production credentials.
- Logging guidance excludes source content, prompts, credentials, signed URLs,
  tokens, cookies, and unnecessary identifiers.
- No product domain, Milestone 1B, or Milestone 1C behaviour is introduced.
- The final Milestone 1A diff contains only the approved repository-foundation
  scope and reports every check actually run.
