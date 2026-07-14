# Cumulore P0 Architecture

**Status:** Proposed for final implementation-readiness review

**Scope:** Production-minded private alpha

**Last updated:** 2026-07-13

This document converts the approved product blueprint into an implementation
shape. Planned topic documents shown in the repository tree do not yet exist;
until they are created, this document and accepted ADRs are authoritative.

## 1. Decision summary

| Concern | Recommendation |
| --- | --- |
| Repository | One pnpm workspace for TypeScript plus one Python workspace; shared root commands, no build orchestrator until needed |
| Web boundary | One Next.js App Router application containing UI, route handlers, application services, and deterministic product rules |
| Worker boundary | One non-public Python worker process for extraction, indexing, generation, evaluation, and proposal creation |
| Database | One managed PostgreSQL database with pgvector, SQL migrations, explicit table ownership, composite tenant keys, and RLS defense in depth |
| Files | Private S3-compatible storage; short-lived presigned uploads to unique immutable keys |
| Background work | Transactional outbox plus PostgreSQL job table, bounded retries, leases, dead-letter state, and handler-level idempotency |
| Artifacts | Immutable versions, stable block identities, revision records, proposals, optimistic publication, and explicit ownership |
| Folder scope | Transactional closure table plus layered policy overrides and immutable source-scope snapshots |
| Retrieval | Tenant and folder filtering before hybrid keyword/vector ranking; every cited claim points to a source version, chunk, and locator |
| Authentication | Managed OpenID Connect provider behind an identity adapter; external subject mapped to an internal user |
| Authorization | Server-side workspace membership plus database RLS; no folder ACLs in the alpha |
| Observability | Structured redacted logs, trace/correlation IDs, metrics, error reporting, and per-operation model/cost records |
| Environments | Local, CI, development, staging, and production are isolated; staging and production use separate accounts, databases, buckets, keys, and identity tenants; web and worker are promoted as immutable application builds or container artifacts |

This is a modular monolith with workers. Modules are code and ownership
boundaries, not network services.

## 2. Proposed repository tree

```text
Cumulore/
├── AGENTS.md
├── README.md
├── .gitignore
├── package.json                 # root scripts and pnpm workspace metadata
├── pnpm-workspace.yaml
├── pyproject.toml               # Python tooling and worker workspace
├── docs/
│   ├── PRODUCT_BLUEPRINT.md
│   ├── MVP_SCOPE.md
│   ├── ARCHITECTURE.md
│   ├── DATA_MODEL.md             # planned
│   ├── AI_PIPELINE.md            # planned
│   ├── AI_EVALUATION.md          # planned
│   ├── SECURITY.md               # planned
│   ├── DESIGN_SYSTEM.md          # planned
│   ├── ROADMAP.md
│   └── decisions/
├── specs/
│   ├── current-milestone.md
│   └── completed/
├── apps/
│   └── web/
│       ├── src/app/             # routes, layouts, route handlers
│       ├── src/components/      # presentation components
│       ├── src/modules/         # domain/application/infrastructure modules
│       └── tests/
├── services/
│   └── worker/
│       ├── src/cumulore_worker/
│       │   ├── jobs/
│       │   ├── extraction/
│       │   ├── retrieval/
│       │   ├── generation/
│       │   └── evaluation/
│       └── tests/
├── packages/
│   ├── schemas/                 # versioned JSON Schema and fixtures
│   ├── database/                # SQL migrations and generated DB types
│   └── test-support/            # cross-tenant and contract fixtures
└── .local/                      # ignored private and temporary material
```

Only directories needed by the active milestone should receive packages. Do
not add a component library package, infrastructure monorepo, or generic
`utils` package before two real consumers exist.

## 3. Runtime boundaries

### 3.1 Next.js application

`apps/web` is both the browser application and public product API.

- App Router pages and components render UI; they do not contain authorization,
  ownership, versioning, or scope rules.
- Route handlers validate authentication, request schemas, and idempotency
  headers, then invoke application services.
- Server Components call application services directly instead of making HTTP
  calls back into the same application.
- Application modules own transactions and enforce workspace scope.
- Infrastructure adapters encapsulate PostgreSQL, object storage, identity,
  model-provider configuration, email, and telemetry.
- Only this runtime can mutate workspace membership, folder policy, recipe
  policy, published artifact state, block ownership, or deletion requests.

Initial modules are `identity`, `workspaces`, `folders`, `sources`, `artifacts`,
`automation`, `retrieval`, `practice`, `usage`, and `audit`. They remain in one
deployment and may use in-process calls.

### 3.2 Python worker

`services/worker` runs durable jobs and has no public endpoint.

- It performs file inspection, deterministic extraction, chunking, embeddings,
  retrieval preparation, model calls, citation validation, and evaluations.
- It consumes identifier-only job payloads and obtains private content through
  workspace-scoped repositories after setting transaction-local tenant context.
- It may write source-processing records, chunks, embeddings, run usage, and
  update proposals.
- It cannot publish an artifact version, change ownership, bypass a lock,
  change permissions, or hard-delete a workspace.
- A future internal API requires a new ADR; the alpha uses database-backed jobs
  and object storage.

### 3.3 Table ownership

| Owner | May write |
| --- | --- |
| Web role | Users, memberships, folders, sources and upload sessions, recipes, published artifacts, blocks, versions, proposal decisions, deletion requests, audit events |
| Worker role | Job leases/results, extraction records, chunks, embeddings, retrieval diagnostics, generation attempts, citations under a proposal, usage measurements |
| Migration role | DDL and controlled data migrations; never used by a runtime |

The worker reads only the minimum product records needed for its current job.
Publication is a web-owned transaction that revalidates proposal status,
workspace, current artifact version, and block ownership.

## 4. PostgreSQL and tenancy

PostgreSQL is the source of truth. Every workspace-owned domain table includes
a non-null `workspace_id`. Relationships between workspace-owned tables use
`(workspace_id, id)` composite foreign keys so an incorrect application query
cannot connect records across workspaces.

`users` and `external_identities` are account-level and do not carry
`workspace_id`. The initial Auth0 integration uses its supported secure
server-side session mechanism rather than an application session table.
`workspace_members` connects an account-level `user` to a `workspace` and is
the authorization boundary between the two scopes.

Application repositories require a `WorkspaceContext`; accepting a bare record
ID is an API design error. Each transaction sets authenticated actor and
workspace context locally. RLS policies are enabled and forced on
workspace-owned domain tables:

- the web role must have active membership in the current workspace for
  workspace-owned data, while account-level access must match the authenticated
  user;
- the worker role may access only the workspace assigned to its claimed job;
- runtime roles cannot bypass RLS or own protected tables;
- administrative migration and break-glass roles are separate and audited.

RLS is defense in depth, not a replacement for explicit predicates. Tests must
exercise both application checks and database denial. The detailed data-model
document remains planned; ADR-0002 records the controlling tenancy decision.

## 5. Durable events and jobs

### 5.1 Transactional model

A command writes domain state and an append-only outbox event in the same
transaction. A dispatcher selects a bounded, deterministically ordered batch
with `FOR UPDATE SKIP LOCKED`, creates every applicable handler job, and records
dispatch completion in one short transaction with no external calls. Jobs use
an unversioned `handler_name`, numeric `handler_version`, and uniqueness on
`(event_id, handler_name, handler_version)`.

Workers claim due jobs through the narrow PostgreSQL claim function defined by
ADR-0003. The function uses database time, orders eligible work
deterministically, claims at most 10 jobs, creates immutable attempts, and
increments a lease generation. The default lease is 60 seconds with a
20-second heartbeat. Completion and effects are fenced by job, attempt, worker,
state, and lease generation. Handler execution never holds an open database
transaction, and every processing transaction sets the claimed workspace
locally under the worker role's forced RLS policies.

PostgreSQL is sufficient for private-alpha volume and avoids operating Redis or
a broker. Queue depth, claim latency, database CPU, and lock time are measured.
Move jobs behind a dedicated broker only if those measurements or an
availability requirement justify it; the versioned event envelope is the
escape hatch.

### 5.2 Event envelope

Every event contract in `packages/schemas` uses an immutable versioned
envelope. Producers validate before writing; consumers validate before handling
and declare the versions they support:

```json
{
  "event_id": "uuid",
  "event_type": "source.upload.finalized",
  "schema_version": 1,
  "occurred_at": "UTC RFC3339 timestamp",
  "workspace_id": "uuid",
  "actor": { "type": "user", "id": "uuid" },
  "correlation_id": "uuid",
  "causation_id": "uuid-or-null",
  "payload": { "source_version_id": "uuid" }
}
```

Workspace-owned events require `workspace_id`; approved account-level or global
operational events may use null. Actor types are `user`, `system`, and `worker`;
user and worker actors require an ID. Events contain identifiers and
non-sensitive control metadata, never source text, prompts, tokens, signed URLs,
or credentials.

### 5.3 Idempotency

- Public mutating endpoints that a client may retry require an
  `Idempotency-Key` scoped by workspace when applicable, actor, route or
  operation, and key. Records contain a canonical request hash, status, safe
  response or reference, and expiry; completed records default to 24-hour
  retention. Matching requests replay or report in-progress, while a different
  hash conflicts.
- For database-only commands, idempotency state, domain mutation, outbox event,
  and completed response commit atomically.
- Job effects use a unique key containing workspace, operation, destination,
  input version, handler version, and configuration version. A database-only
  effect, attempt completion, and job success commit in one fenced transaction.
- External operations persist a stable provider idempotency key before calling.
  Unknown results require reconciliation; operations without provider
  idempotency or reconciliation cannot retry automatically. Milestone 1C uses a
  deterministic fake provider only.
- Automatic attempts use full-jitter backoff from 5 seconds to a 15-minute cap,
  with at most 5 attempts per retry generation and 10 lifetime attempts. Lease
  and retry timing use PostgreSQL time.
- Manual retry requeues the same dead-letter job, increments
  `retry_generation`, preserves the handler version, records actor/reason/time,
  and creates an attempt only when claimed.
- Jobs move only through `pending`, `running`, `retry_wait`, `succeeded`,
  `dead_letter`, and `cancelled`. Running cancellation is cooperative and fenced;
  success committed before cancellation remains final, while cancellation
  committed first rejects later completion.

ADR-0003 defines the complete transition, fencing, external-operation,
retention, and cleanup rules. It is accepted as implementation authority for
Milestone 1C.

### 5.4 Initial event contracts

| Event type | Schema version | Producer | Consumer/result |
| --- | ---: | --- | --- |
| `source.upload.finalized` | 1 | Web | Validate and quarantine file |
| `source.validation.succeeded` | 1 | Worker | Hash, duplicate check, extract |
| `source.extraction.completed` | 1 | Worker | Chunk and index source version |
| `source.indexing.completed` | 1 | Worker | Evaluate eligible recipe version |
| `recipe.run.requested` | 1 | Web/worker dispatcher | Create immutable automation run |
| `artifact.proposal.created` | 1 | Worker | Expose proposal for review |
| `artifact.version.published` | 1 | Web | Update search/read model and notify |
| `source.deletion.requested` | 1 | Web | Exclude immediately, purge asynchronously |
| `workspace.deletion.requested` | 1 | Web | Revoke access and execute deletion workflow |

Events report facts. Jobs use unversioned imperative names such as
`extract_source` together with a numeric `handler_version`.

## 6. Upload and processing lifecycle

1. The authenticated user selects a target folder. The web service authorizes
   membership and creates `Source`, `SourceVersion`, and an expiring
   `UploadSession` in `awaiting_upload` state.
2. The server returns a short-lived presigned PUT for a new immutable quarantine
   key. The key is generated server-side and cannot overwrite another version.
3. The client uploads directly, then finalizes with the session ID, expected
   size, and checksum when available.
4. The web service performs an object `HEAD`, validates the session and limits,
   atomically marks it `uploaded`, and emits `source.upload.finalized` with
   `schema_version: 1`. A sweeper expires abandoned sessions.
5. The worker streams the object through malware scanning, content/MIME checks,
   archive and size limits, and a server-computed SHA-256 hash. Until this
   succeeds, the object is quarantined and cannot be downloaded or parsed.
6. Exact duplicates are detected within the workspace. The run pauses in
   `duplicate_confirmation_required`; the user may link to the existing source
   or explicitly retain a second source. No chunks or embeddings are duplicated
   before that choice.
7. A format-specific deterministic extractor creates an immutable normalized
   extraction with parser version, quality report, structural elements, and
   page/slide/section locators. The first vertical slice supports PDF and
   TXT/pasted text; DOCX and PPTX follow through the same extraction interface.
   A failed extraction becomes actionable failure, never an empty success.
8. Structure-aware chunks and checksums are created. PostgreSQL full-text data
   and versioned embeddings are written idempotently.
9. The pinned recipe version creates an `AutomationRun`. Source notes, practice
   items, or living-document changes are generated as structured proposals.
10. Citation and schema validation either accept the proposal for review or
    record a visible failure/uncertainty. The worker cannot publish it.
11. The user reviews a diff. Acceptance publishes a new immutable version in a
    transaction; rejection preserves the proposal for audit. Notifications are
    triggered from the publication event.

Status is a finite state machine. Invalid transitions fail deterministically,
and every externally visible run reaches `succeeded`, `action_required`,
`failed_terminal`, or `cancelled`.

## 7. Artifact ownership and versioning

An `Artifact` is a durable document identity. `ArtifactVersion` is an immutable
published snapshot. `ArtifactBlock` gives a logical block a stable ID and
ownership. `ArtifactBlockRevision` stores immutable content. A version orders
the revisions it contains.

Ownership states are:

- `ai_managed`: automation may propose a replacement;
- `shared`: automation may propose, and a user must accept;
- `user_managed`: automation may read the block as context but cannot replace
  it;
- `locked`: automation may read the block as context but cannot replace or move
  it.

Ownership controls mutation, not AI visibility. Each block also has an
independent `ai_processing_policy` of `included` or `excluded`. Excluded content
must not be sent to a model, embedded, summarized, or used as AI context,
regardless of ownership. User-managed and locked content is readable as context
when this policy is `included`.

“Generated snapshot” is a version status, not an ownership state. Editing an
AI-managed block changes it to `user_managed` by default unless the user
explicitly opts back into AI management. The private alpha does not auto-publish
changes to existing blocks.

An update proposal records its base version and ordered operations (`insert`,
`replace`, `move`, `mark_conflict`, `no_action`). Publication uses optimistic
concurrency: if the current version differs from the base, the proposal must be
rebased and ownership rechecked. Restoration creates a new version referencing
historical revisions; it never deletes history.

## 8. Folder scope inheritance

Folders use a tenant-scoped closure table to resolve ancestors and descendants.
Moves update the closure rows and validate against cycles in one transaction.

Settings are layered, not copied. Each policy field is either inherited or an
explicit override. Resolution walks root to leaf and returns both the effective
value and the folder/policy version that supplied it. Recipe runs pin the
resolved policy and recipe versions.

Alpha information flow is deterministic:

- own-folder scope includes only sources directly in the folder;
- descendant scope includes the folder and descendants when explicitly chosen;
- siblings are never implicit;
- cross-folder selected scope is explicit;
- a generated version records the exact source versions it used.

Moving a folder never changes an existing artifact or source-scope snapshot.
The alpha supports “move only”; inheriting new settings or re-synthesis requires
an explicit preview and later milestone.

## 9. Retrieval and provenance

Permission and source-scope filters are applied in SQL before keyword or vector
ranking. Retrieval cannot fetch broadly and filter after model access.

Each chunk belongs to one immutable `SourceVersion` and stores stable structural
context, a locator, text checksum, extraction version, and token count.
Embeddings are separate versioned records so a model change does not mutate the
source chunk. Hybrid results are fused deterministically and may be reranked
only inside the already-authorized candidate set.

Generation records claims separately from rendered prose. A citation connects a
claim to a chunk and optional character span, with support status and validator
version. Direct support, cross-source synthesis, external explanation,
uncertainty, and contradiction are distinct claim types. An unsupported direct
claim is weakened, labelled, regenerated, or rejected; it is never given a
decorative citation.

The detailed AI pipeline document remains planned. The rules above apply until
that document and its ADR are approved.

## 10. Authentication, authorization, and deletion

- Use Auth0 Public Cloud in the Australia region for staging and production,
  through a Cumulore-owned identity-provider adapter using the official
  Auth0-supported Next.js SDK. Store the OIDC issuer and subject beside an
  internal user ID; never make provider IDs tenant keys or use email as the
  permanent external identity key. ADR-0009 is the controlling decision.
- Use Auth0 Universal Login with the database email/password connection for
  the private alpha. Social connections are deferred and must not change the
  internal identity model. Auth0 Organizations, roles, `app_metadata`, and
  `user_metadata` are not authorization sources of truth.
- Sessions use the supported secure server-side integration mechanism with
  secure, HTTP-only, same-site cookies. Route handlers derive the actor
  server-side; clients never assert workspace membership. Do not add an
  application session table without a demonstrated need.
- Workspace roles are `owner` and `member` in the alpha. Destructive workspace
  and membership operations require `owner`.
- Download URLs are issued only after authorization and expire quickly.
- A source deletion immediately removes it from retrieval and automation, then
  asynchronously purges original objects, extracted text, chunks, embeddings,
  caches, and pending jobs. Dependent artifacts are flagged for evidence review.
- Workspace deletion immediately revokes normal access, cancels work, exports
  if requested, then purges tenant data and objects through an auditable
  idempotent workflow.
- Account deletion is separate. A sole owner must delete the workspace or
  transfer ownership before their identity record can be purged.

Local development and CI use a deterministic fake identity-provider adapter
and do not contact Auth0. Retention durations and any recovery grace period
must be approved before deletion implementation in Milestone 6. The detailed
security document remains planned; ADR-0007 will capture the final deletion
decisions.

## 11. Testing and observability foundation

### Tests

- TypeScript and Python unit tests for policies, state machines, scope,
  idempotency, ownership, diffing, and citation validation.
- Contract tests validate every event fixture in TypeScript and Python and
  reject incompatible schema changes.
- Integration tests use real PostgreSQL with RLS and S3-compatible storage for
  upload, queue, extraction, publication, retry, and deletion paths.
- Durable-processing integration tests cover concurrent dispatch and claims,
  duplicate delivery, crash boundaries, lease renewal/reclaim, stale-worker
  fencing, idempotency conflicts, cancellation races, handler-version draining,
  manual retry, fake-provider reconciliation, retention cleanup, and
  cross-workspace denial under forced RLS.
- A cross-tenant matrix attempts read/write/search/download access with valid,
  missing, and mismatched IDs.
- Browser journeys cover upload, status, review, edit/lock, later update,
  restoration, cited answer, export, and deletion.
- AI regression tests use a versioned, non-private evaluation corpus and gate
  prompt/model/parser/chunking changes.

### Observability

- JSON logs include timestamp, level, service, environment, trace ID,
  correlation ID, workspace hash/opaque ID when needed, operation, and safe
  error code. They exclude source text, filenames where unnecessary, prompts,
  model responses, tokens, signed URLs, cookies, and credentials.
- Traces span web commands, outbox dispatch, job attempts, object operations,
  retrieval, and model calls. Trace propagation uses the event envelope.
- Metrics cover request latency/error rate, upload finalization, queue depth and
  age, retries/dead letters, processing duration, extraction quality, retrieval
  latency/recall samples, citation rejection, model usage/cost, publication
  conflicts, and deletion lag.
- User-visible activity is product state, not inferred from logs.

## 12. Environment model

| Environment | Data and infrastructure |
| --- | --- |
| Local | Containerized PostgreSQL with pgvector and S3-compatible storage; deterministic fake identity, mail, and model adapters; `.env.local` only |
| CI | Ephemeral database and object store per run; deterministic fake identity and model fixtures; no production credentials |
| Development | Shared non-production account/project using synthetic or explicitly approved test data |
| Staging | Production-shaped, separate Australia-region Auth0 tenant, account/project, database, bucket, keys, quotas, and model credentials; no copied production documents |
| Production | Dedicated Australia-region Auth0 tenant, account/project, least-privilege roles, managed secrets, encryption, backups, restore tests, alerts, and access audit |

Build one immutable web application artifact and one immutable worker
application artifact, using a container artifact where the selected host
requires it. Promote the same artifacts through environments with configuration
and secrets injected at runtime. Database migrations run as a separate release
step with backward-compatible expand/migrate/contract sequencing. Preview
environments may use isolated synthetic data only.

## 13. Technology justification

- **Next.js/React/strict TypeScript:** approved product direction and one small
  team can own UI and product API together.
- **Python with typed validated boundaries:** document and AI ecosystems without
  giving Python ownership of authorization or publication.
- **PostgreSQL:** transactions, relational integrity, RLS, full-text search,
  durable job claiming, and vector retrieval through one operated datastore.
- **S3-compatible storage:** originals are too large and sensitive for the
  relational database; presigned direct upload avoids proxying bytes through the
  web process.
- **JSON Schema contracts:** language-neutral runtime validation and fixture-
  based compatibility between TypeScript and Python.
- **OpenTelemetry-compatible telemetry:** vendor-neutral correlation across web
  and worker.

No production dependency is approved merely by appearing here. Milestone 1A
must record each selected library, license, maintenance status, and why a
standard-library or existing option is insufficient.

## 14. Risks and unresolved decisions

These decisions do not change the application boundary, but must be closed at
the named gate:

| Decision | Default/recommendation | Required by |
| --- | --- | --- |
| Deployed object storage | Private S3-compatible service behind the storage adapter | Milestone 2A, before non-local ingestion |
| Upload limits | Start with format-specific limits based on extraction/load tests, not marketing promises | Milestone 2A, before upload acceptance |
| Malware scanner | Isolated scanner with signature updates and fail-closed quarantine | Milestone 2A, before file validation |
| Embedding/model provider | Adapter plus evaluation/cost gate; provider may not train on private content | Milestone 3, before the first external model call |
| Recovery and deletion grace | Immediate logical exclusion; propose 7-day workspace recovery and 30-day backup expiry subject to privacy/legal review | Before deletion implementation in Milestone 6 |
| Hosting provider and region | Separate web and worker deployment units using immutable builds or container artifacts | Milestone 6, before staging provision |
| Telemetry backend | OpenTelemetry-compatible backend with redaction controls | Milestone 6, before staging provision |
| OCR | Disabled by default; opt-in fallback after quality/cost evaluation | Scanned-document support |
| Near-duplicate policy | Informational warning after exact duplicate handling | Post-alpha ingestion |
| Auto-apply policy | Proposal-only for existing blocks | Reconsider after alpha safety data |
| Pricing and billing | Outside private-alpha foundation | Public beta planning |

Milestone 1A requires no external provider selection. Auth0 is selected for
Milestone 1B by ADR-0009, and ADR-0002 is accepted for tenancy implementation.
ADR-0003 is accepted for Milestone 1C.
Milestones 1A-1C do not need to invent a service split, tenant model, queue,
version model, folder scope, or contract strategy while coding. The ordered
delivery gates are defined in `docs/ROADMAP.md`.

## 15. Reference basis

The recommendations align with current primary documentation for
[Next.js App Router and Route Handlers](https://nextjs.org/docs/app),
[PostgreSQL row-security policies](https://www.postgresql.org/docs/current/sql-createpolicy.html),
[PostgreSQL locking and `SKIP LOCKED`](https://www.postgresql.org/docs/current/sql-select.html),
[pgvector hybrid search](https://github.com/pgvector/pgvector),
[S3 presigned uploads](https://docs.aws.amazon.com/AmazonS3/latest/userguide/PresignedUrlUploadObject.html),
and [OpenID Connect](https://openid.net/specs/openid-connect-core-1_0-18.html).
