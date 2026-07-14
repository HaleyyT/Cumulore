# Cumulore Private-Alpha Roadmap

**Status:** Proposed for final implementation-readiness review

**Last updated:** 2026-07-13

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
- Dispatcher, jobs, leases, attempts, bounded retries, cancellation, and
  dead-letter state.
- Endpoint and handler-effect idempotency records.
- A synthetic event-to-worker-to-terminal-state path and operational metrics.

### Readiness and exit gates

- **ADR-0003 must be reviewed and accepted before Milestone 1C
  implementation.**
- No model or production-hosting provider is required.
- Duplicate delivery, lease expiry, retry exhaustion, manual retry, and worker
  interruption are covered by integration tests.

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

## Milestone 2B: Remaining ingestion formats

Add DOCX and PPTX through the same extraction, locator, quality, error, and
idempotency contracts established in Milestone 2A. All four file formats are
required before private-alpha ingestion is complete.

## Milestone 3: Retrieval and citations

Add structure-aware chunks, PostgreSQL full-text search, pgvector embeddings,
folder-filtered hybrid retrieval, scope snapshots, cited question answering,
and insufficient-evidence behaviour. Select embedding and model providers
immediately before the first external model call and require privacy, cost, and
evaluation review.

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
