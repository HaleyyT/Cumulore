# Cumulore Private-Alpha Roadmap

**Status:** Active

**Last updated:** 2026-07-15

Milestones are ordered by dependency. A milestone begins only when its listed
readiness gates are closed. Provider decisions are deferred until the first
milestone that needs them.

## Milestone 1A: Repository foundation

### Outcome

Create the smallest repeatable TypeScript/Python development foundation without
connecting to external production providers.

### Deliverables

- Repository workspaces, root quality commands, and documented dependency
  policy.
- Strict TypeScript and typed Python quality configuration.
- Versioned JSON Schema location and a cross-language fixture contract.
- Local PostgreSQL with pgvector and a local S3-compatible test interface.
- CI for formatting, linting, type checking, unit tests, contract checks, and
  documentation links.
- Redacted structured logging and correlation-ID conventions.

### Readiness and exit gates

- No external identity, model, object-storage, telemetry, or production-hosting
  provider is required.
- Root checks run reproducibly in local development and CI.
- No product domain or upload workflow is implemented yet.

## Milestone 1B: Identity and tenancy

### Outcome

Establish authenticated account scope and enforce workspace isolation before
private domain data is introduced.

### Deliverables

- Account-level users and external identities, with the selected integration's
  supported secure server-side session mechanism; no application session table
  without a demonstrated need.
- Workspaces, workspace members, folders, and folder closure.
- Web, worker, migration, and break-glass database roles.
- Explicit workspace-scoped repositories, forced RLS, and cross-tenant tests.

### Readiness and exit gates

- **ADR-0002 and ADR-0009 are accepted for Milestone 1B implementation.**
- Auth0 Public Cloud in the Australia region is the managed OIDC provider;
  Auth0 Universal Login and the database email/password connection are the
  private-alpha starting point.
- Authorized account/workspace operations succeed and the complete
  cross-tenant matrix is denied by application checks and PostgreSQL policies.

## Milestone 1C: Durable processing foundation

### Outcome

Prove retry-safe background execution with synthetic work before processing
private source files.

### Deliverables

- Transactional outbox events and versioned language-neutral event schemas.
- Atomic bounded dispatch; fenced PostgreSQL claims; jobs, leases, attempts,
  bounded retries, cooperative cancellation, and dead-letter state.
- Endpoint and handler-effect idempotency records.
- A synthetic event-to-worker-to-terminal-state path, deterministic fake
  external provider, retention cleanup, and operational metrics.

### Readiness and exit gates

- **ADR-0003 is accepted for Milestone 1C implementation.**
- No model or production-hosting provider is required.
- Real-PostgreSQL integration tests cover concurrent dispatch/claim, duplicate
  delivery, crash boundaries, renewal, lease expiry/reclaim, stale-worker
  fencing, endpoint and effect idempotency, cancellation races, handler-version
  draining, retry exhaustion, manual retry, forced-RLS isolation, fake-provider
  reconciliation, and referentially safe cleanup.

## Milestone 2A: First ingestion vertical slice

### Outcome

Process PDF and TXT/pasted text from authorized upload through normalized
extraction and visible terminal status.

### Deliverables

- Presigned quarantine upload and finalization.
- MIME/content validation, malware scanning, hashing, and exact duplicate flow.
- Shared extraction interface, normalized elements, locators, and quality
  report.
- PDF and TXT/pasted-text extractors.

### Readiness and exit gates

- Select deployed private S3-compatible storage before non-local ingestion.
- Select the malware scanner and approve initial upload limits before accepting
  files.
- Every supported input reaches `succeeded`, `action_required`,
  `failed_terminal`, or `cancelled` without duplicate downstream records.

## Milestone 2A-H: Operational foundation and performance baseline

### Outcome

Prove that the accepted first ingestion and durable-processing foundations are
reproducible, tenant-safe, observable, and measurable before adding formats or
production providers.

### Deliverables

- Query ownership, transaction, tenant-predicate, cardinality, and index
  catalogue for the implemented application surface.
- Migration-owned aggregate operational metrics and documented connection,
  timeout, slow-query, and recovery policies.
- A development-only Testcontainers PostgreSQL/pgvector harness that runs fresh
  migrations, TypeScript/Python integration suites, and worker smoke through the
  same command locally and in CI.
- Runtime upload validation, safe typed errors, and a fail-closed origin policy
  for future state-changing browser handlers.
- Redacted vendor-neutral structured logs, correlation propagation fields, and
  a deterministic synthetic performance-baseline command.

### Readiness and exit gates

- Milestone 2A is accepted at its local/private-alpha boundary; non-local
  storage and malware-provider selection remain deferred until deployment.
- `pnpm verify` and `pnpm test:integration:isolated` pass from a clean install.
- Performance evidence uses synthetic data and ignored local output; timing
  thresholds are reviewed on a documented reference environment, not enforced
  as flaky shared-CI wall-clock assertions.
- No DOCX/PPTX, production storage, OpenTelemetry backend, Redis, broker, Kafka,
  cloud provider, Spring service, or product feature is introduced.
- **Milestone 2A-H is accepted at the local/private-alpha boundary.**

## Milestone 2B: Remaining ingestion formats

Add DOCX and PPTX through the same extraction, locator, quality, error, and
idempotency contracts established in Milestone 2A. All four file formats are
required before private-alpha ingestion is complete. The implementation is
tracked in `specs/milestone-2b-remaining-ingestion-formats.md` and is awaiting
review after its clean-room verification.

## Milestone 3: Retrieval and citations

Add structure-aware chunks, PostgreSQL full-text search, pgvector embeddings,
folder-filtered hybrid retrieval, scope snapshots, cited question answering,
and insufficient-evidence behaviour. The first fifteen reviewable retrieval slices
are implemented in `specs/milestone-3-retrieval-citations.md`, including
deterministic candidate reranking, claim support scoring, and a versioned
grounded-answer proposal contract;
and an immutable review decision contract, plus a deterministic
publication-eligibility gate, and a deterministic grounded-answer evaluation
report, a combined publication-readiness gate, and an optimistic-concurrency
publication intent, deterministic intent-resolution conflict handling, and a
retry-safe idempotency-keyed publication command;
embedding/model providers remain blocked on privacy, cost, and evaluation
review.

## Milestone 4: Source notes and recipes

Add the versioned Course Companion recipe, source-note generation, claim and
citation validation, artifact/block storage, editing, ownership, locking,
activity visibility, and usage limits.

## Milestone 5: Living documents, ownership, and review

Add affected-block selection, immutable proposals, diffs, optimistic
publication, conflicts, restoration, and source-deletion evidence review.
Existing living-document changes remain proposal-only for the private alpha.
Ownership governs replacement and movement; the independent AI-processing
policy governs whether block content may be used by AI.

## Milestone 6: Practice, deletion, and alpha hardening

Add cited practice questions, reporting, Markdown/JSON export, account and
workspace deletion, accessibility validation, security review, runbooks, and
private-alpha onboarding.

Before staging, select the production hosting provider and region, telemetry
backend, retention periods, recovery grace policy, and backup expiry. Promote
the same immutable application builds or container artifacts through staging
and production.

## Deferred decisions

- OCR remains disabled by default until quality and cost evaluation justifies
  it.
- Near-duplicate detection remains informational and post-alpha; exact
  duplicate handling is required.
- Billing, multi-region deployment, folder-level ACLs, and automatic publishing
  of existing-block changes are outside this roadmap.
