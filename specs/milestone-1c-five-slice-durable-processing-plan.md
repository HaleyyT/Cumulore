# Milestone 1C — Five-Slice Durable Processing Plan

**Status:** Approved implementation plan

**Execution rule:** Each slice is a separate reviewable diff and must be
accepted before the next slice begins. A slice must not absorb work assigned to
a later slice.

**Current gate:** Slice 1C.1 and Slice 1C.2 are accepted for implementation
handoff. Slice 1C.3 has been implemented and is awaiting review and acceptance.

## Purpose

Prove retry-safe durable processing with synthetic work before private source
files or product automation are introduced.

## Locked decisions

- Python owns dispatcher, executor, and maintenance roles through one
  package/artifact.
- Handler activation is migration-owned database state.
- The synthetic command is an internal TypeScript service with no HTTP route.
- Cross-workspace operations occur only through narrow migration-owned
  functions.
- Initial executor concurrency is one; database claims support at most ten.
- No uploads, extraction, storage processing, AI, retrieval, product UI, real
  providers, broker, Redis, Celery, ORM, or scheduler are part of this
  milestone.

## 1C.1 — Schema, Contracts, and Migrations

### Deliverables

Add the `durable.synthetic.requested` schema version 1 JSON Schema with:

- an immutable unversioned event type plus numeric schema version;
- complete envelope and actor rules;
- workspace-required scope;
- an identifier-only `synthetic_operation_id` payload;
- valid and invalid fixtures consumed by TypeScript and Python.

Promote Ajv to a runtime dependency of `packages/schemas`. Keep the existing
`jsonschema` dependency available to Python contract tests; move it to Python
runtime dependencies only in 1C.5 when the worker consumes events.

### Migration sequence

1. `003_grant_public_schema_to_migration_role.sql`
   - Grant the no-login migration role the schema privileges required to own
     reviewed database objects.
2. `004_durable_processing_schema.sql`
   - Set the migration role locally.
   - Create all enums, tables, constraints, indexes, forced-RLS policies, and
     the attempt-history guard trigger.
   - Seed only the synthetic handler registration.
   - Reset the role before the migration runner records completion.

### Tables

#### `synthetic_operations`

- `id`, `workspace_id`, `requested_by_user_id`
- `scenario`: database effect, external success, unknown-then-success,
  retryable failure, non-retryable failure, or cooperative wait
- `input_version`, `configuration_version`, `created_at`
- Composite tenant key `(workspace_id, id)`
- Forced RLS for authorized web creation and workspace-scoped worker reads

#### `outbox_events`

- `id`, `scope`, nullable `workspace_id`
- `event_type`, `schema_version`, `occurred_at`
- `actor_type`, nullable `actor_id`
- `correlation_id`, nullable `causation_id`
- Identifier-only `payload`
- Nullable `dispatch_completed_at`, `dispatched_handler_count`
- Checks enforcing actor, scope/workspace, JSON-object, naming, and
  positive-version rules
- Composite uniqueness allowing jobs to reference workspace, event, type, and
  schema
- Partial indexes for undispatched selection and dispatched cleanup, plus
  workspace and correlation indexes

#### `event_handlers`

- Event type/schema and handler name/version
- `requires_workspace`, `active`, `created_at`, nullable `deactivated_at`
- Primary key across the four identity/version columns
- Partial uniqueness for one active version of each handler
- Seed: `durable.synthetic.requested` schema 1 to `run_synthetic` handler 1
- No runtime mutation grant

#### `endpoint_idempotency_records`

- Nullable workspace scope, actor, operation, and key
- 32-byte canonical request hash
- `processing` or `completed` status
- Safe response status/body or response reference
- Creation, update, and expiry timestamps
- `UNIQUE NULLS NOT DISTINCT` across workspace, actor, operation, and key
- Response-shape, length, and state-consistency checks
- Forced RLS matching actor and workspace/account scope
- Partial expiry index

#### `jobs`

- Workspace, event identity/schema, and pinned handler identity/version
- Six-state enum, availability, creation/update, and terminal timestamps
- Retry generation, generation-attempt count, and lifetime-attempt count
- Lease generation, active attempt, owner, and expiry
- Cancellation request and safe last-error code
- Unique `(event_id, handler_name, handler_version)`
- Composite tenant-safe event and handler-registration foreign keys
- Checks enforcing attempt limits, running lease requirements, and terminal
  state
- Partial indexes for claims, expired leases, terminal cleanup, dead letters,
  and nonterminal handler versions

#### `job_attempts`

- Workspace/job IDs, retry generation, and generation/lifetime attempt numbers
- Lease generation and worker owner
- Start/end timestamps, outcome, retry classification, safe error code, and
  safe usage metadata
- Uniqueness per job for lease generation and both attempt counters
- Composite workspace foreign keys
- Guard trigger allowing only one closure of an open attempt; closed history
  cannot change

#### `job_actions`

- Workspace/job, action, actor, and reason
- Previous/next state, retry generation, and timestamp
- Append-only runtime policy
- Partial uniqueness rejecting duplicate manual retries for the same generation

#### `job_effects`

- Workspace/job/attempt
- Operation, destination, and input version
- Handler name/version and configuration version
- Safe result/reference and timestamp
- Unique database-effect key containing every ADR-required component

#### `external_operations`

- Workspace/job/attempt
- Logical operation ID, sequence, and same-workspace predecessor
- Provider/operation names and stable provider idempotency key
- Request hash, external-operation state, safe provider reference/error
- Reconciliation owner, lease expiry/generation, and next-reconcile time
- Creation, update, and resolution timestamps
- Unique logical-operation sequence, with predecessor and state consistency
  checks
- Indexes for due reconciliation, job history, and retention

### 1C.1 acceptance gate

- Fresh migrations succeed atomically.
- All new objects are owned by `cumulore_migration`.
- Runtime roles have no broad cross-workspace access or `BYPASSRLS`.
- Contract fixtures pass in both languages; invalid and unsupported versions
  fail.
- Table, constraint, index, RLS, and handler-seed inspection tests pass.
- No dispatcher, executor, maintenance loop, or later-slice behavior function
  exists.

## 1C.2 — Dispatch and Atomic Claiming

### Migration

Create `005_dispatch_and_claim_functions.sql` with migration-owned functions,
fixed search paths, explicit argument validation, `PUBLIC` execution revoked,
and worker-only execution grants:

- `app.dispatch_outbox(batch_size DEFAULT 50)`, hard range 1–100
- `app.claim_jobs(worker_owner, batch_size DEFAULT 1, lease_seconds DEFAULT 60)`,
  hard batch range 1–10 and bounded lease range

### Outbox producer boundary

Add internal TypeScript primitives:

- `appendOutboxEvent(client, validatedEvent)`
- `createSyntheticOperationAndEvent(client, input)`

The caller supplies an existing actor transaction so synthetic state and event
commit or roll back together. Endpoint idempotency remains excluded until
1C.4.

### Dispatch transaction

`dispatch_outbox`:

1. Selects undispatched events ordered by `(occurred_at, event_id)`.
2. Locks a bounded set with `FOR UPDATE SKIP LOCKED`.
3. Reads active database handler registrations.
4. Inserts all applicable pinned jobs.
5. Records handler count and dispatch completion.
6. Commits as one short transaction with no external call.

Events with no applicable handler are marked dispatched with count zero. A
workspace-required handler cannot be created from a null-workspace event.

### Claim transaction

`claim_jobs`:

1. Selects due `pending` and `retry_wait` jobs by
   `(available_at, created_at, job_id)`.
2. Uses PostgreSQL time and `FOR UPDATE SKIP LOCKED`.
3. Increments generation/lifetime attempt counters and lease generation.
4. Creates an open immutable attempt.
5. Transitions the job to `running`.
6. Sets owner and the default 60-second lease expiry.
7. Returns identifier-only payload, authoritative workspace,
   correlation/event IDs, handler version, attempt ID, lease generation, and
   expiry.
8. Commits before handler execution.

### 1C.2 tests

- Domain/outbox commit and rollback
- Producer RLS and cross-workspace denial
- Concurrent dispatchers and locked-row skipping
- Dispatcher crash rollback and duplicate redispatch
- Multiple and zero handlers
- Handler activation changes without historical backfill
- Existing jobs retaining pinned versions
- Concurrent claims without duplicates
- Deterministic ordering and batch limits
- Claim/attempt/job-state atomicity
- Worker direct-table denial and worker-only function execution

### 1C.2 acceptance gate

Database tests prove duplicate-safe dispatch and claims. No handler execution,
heartbeat, retry, cancellation, external call, or worker polling exists.

## 1C.3 — Leases, Fencing, Transitions, and Retries

### Migration

Create `006_job_transitions.sql` with migration-owned functions:

- `renew_job_lease`
- `complete_job` for explicitly effectless synthetic work
- `fail_job`
- `reclaim_expired_jobs`
- `request_job_cancellation`
- `acknowledge_job_cancellation`
- `manual_retry_job`

Worker functions require transaction-local workspace plus exact job, attempt,
owner, `running` state, and lease generation. Web functions require an
authenticated actor, matching workspace, and active membership.

### Protocols

- Default lease: 60 seconds; heartbeat: 20 seconds.
- Every reclaim increments lease generation.
- A stale worker cannot renew, complete, fail, cancel, or publish anything.
- Expired attempts close as `abandoned`.
- The automatic-attempt budget includes the initial attempt.
- Maximum five attempts per retry generation and ten lifetime attempts.
- Full jitter:
  `uniform(0, min(15 minutes, 5 seconds × 2^(attempt−1)))`.
- The worker supplies a random fraction; PostgreSQL validates it and computes
  availability from database time. Tests use deterministic fractions.
- Pending or retry-wait cancellation commits immediately.
- Running cancellation records `cancel_requested_at`; acknowledgement is
  cooperative and fenced.
- Success committed first remains final; cancellation committed first rejects
  completion.
- Manual retry is permitted only from dead letter, preserves handler version,
  increments retry generation, records actor/reason/time, and creates no
  attempt until claim.
- Concurrent manual retries fail the atomic state check.

The TypeScript manual-retry service reuses the original operation's
authorization policy; the database independently checks membership and scope.

### 1C.3 tests

- Heartbeat renewal and invalid renewal
- Lease expiry, reclaim, and attempt abandonment
- Stale completion, failure, or cancellation after reclaim
- Failure and completion crash boundaries
- Retryable and non-retryable classification
- Jitter lower/upper bounds and PostgreSQL time
- Generation and lifetime exhaustion
- All legal and illegal state transitions
- Pending/running cancellation races with claim, renewal, completion, failure,
  and reclaim
- Authorized, unauthorized, repeated, and concurrent manual retries
- Closed-attempt immutability

### 1C.3 acceptance gate

The database alone enforces the complete state machine, retry budget,
cancellation ordering, and fencing. Endpoint/effect idempotency and external
operations remain inactive.

## 1C.4 — Idempotency and Fake External Reconciliation

### Migration

Create `007_idempotency_and_external_operations.sql` with migration-owned
functions for:

- fenced database-effect completion;
- preparing an external operation;
- marking invocation in flight;
- recording success, failure, or unknown;
- linking a safe retry using the same provider key;
- claiming due unknown operations for reconciliation;
- resolving reconciliation with its own owner/generation fence.

### Endpoint API

Expose internal TypeScript interfaces:

- `runIdempotentCommand<TRequest, TResponse>`
- `requestSyntheticOperation`
- `requestJobCancellation`
- `manualRetryJob`
- Result union: `executed | replayed | in_progress`
- Typed `IdempotencyConflictError`

Canonical hashing uses Node `crypto` and a repository-owned serializer that
sorts object keys, preserves array order, and rejects unsupported or non-finite
values. Do not add a canonicalization dependency.

For database-only commands, idempotency state, synthetic mutation, outbox
event, and completed response commit atomically.

- The same key/hash waits for the conflicting insertion, then replays or
  reports in progress.
- A different hash conflicts without mutation.
- Workspace and account scopes cannot collide.
- Completed records expire after 24 hours.
- Stored responses exclude secrets, tokens, signed URLs, and source content.

### Effect idempotency

`complete_job_with_effect`:

- verifies workspace and lease fence;
- inserts or finds the unique deterministic effect;
- closes the attempt;
- transitions the job to succeeded;
- commits all three operations atomically.

### Fake external provider

Define a Python `ExternalProvider` protocol:

- `invoke(provider_key, scenario)`
- `reconcile(provider_key)`

The deterministic fake supports:

- confirmed success;
- confirmed non-retryable failure;
- unknown invocation followed by reconciled success;
- a provider lacking idempotency/reconciliation, which must dead-letter without
  a blind retry.

No network call or real provider package is permitted.

Unknown operations receive a reconciliation schedule. The database claim
function returns identifier-only metadata and authoritative workspace.
Reconciliation success is persisted for the later executor to consume without
repeating invocation.

### 1C.4 tests

- Concurrent same-key/same-hash command execution
- Completed replay, in-progress behavior, and different-hash conflict
- Workspace/account scope separation and expiry
- Atomic rollback across idempotency, domain row, and event
- Duplicate database-effect key
- Effect insertion versus stale fence
- Every legal and illegal external-operation transition
- Crash before invocation, after invocation, and before result persistence
- Unknown outcome and reconciled success/failure
- Concurrent reconciliation claims and stale reconciliation fences
- No-idempotency/no-reconciliation prohibition
- No sensitive data in stored responses, operations, or errors

### 1C.4 acceptance gate

The internal synthetic path proves endpoint, effect, and external-operation
idempotency without an HTTP route, polling runtime, or real provider.

## 1C.5 — Worker Runtime, Cleanup, CI, and Full Concurrency Matrix

### Dependency and runtime

Add production dependency `psycopg[binary]==3.3.4` and move `jsonschema` into
runtime dependencies. Psycopg supplies native typed asyncio PostgreSQL access
that is absent from the standard library; no pool extra is required at
concurrency one.

References:

- [Psycopg documentation](https://www.psycopg.org/psycopg3/docs/)
- [Psycopg on PyPI](https://pypi.org/project/psycopg/)

Expose independently startable commands from one artifact:

- `python -m cumulore_worker dispatcher`
- `python -m cumulore_worker executor`
- `python -m cumulore_worker maintenance`
- `python -m cumulore_worker all`
- `--once` for deterministic tests and smoke checks

### Role behavior

#### Dispatcher

- Calls only `dispatch_outbox`.
- Default batch 50, hard maximum 100.
- Never executes handlers or providers.

#### Executor

- Confirms every active/nonterminal pinned handler has a code implementation.
- Claims only available capacity; initial concurrency and claim batch are one.
- Uses separate transactions/connections for claim, workspace reads,
  heartbeat, and fenced result.
- Runs the handler with no open transaction.
- Checks cancellation before provider work and before effect commit.
- Unknown handler versions fail readiness; a post-startup race dead-letters
  safely.

#### Maintenance

- Reclaims expired jobs in batches of 50.
- Claims and reconciles at most ten unknown operations.
- Runs cleanup hourly in batches of 100.
- Logs durable queue metrics every 60 seconds.
- Performs no normal handler execution.

#### All

- Runs three independent asynchronous loops in one local/private-alpha
  process.
- Each loop retains separate failure handling and can be split into separately
  scaled staging or production processes without code changes.

### Graceful shutdown

- `SIGTERM` and `SIGINT` stop new polls immediately.
- Active executor heartbeats continue for up to 45 seconds.
- Completed work commits normally.
- Work exceeding the grace period exits without fabricating a failure;
  maintenance later reclaims its lease.
- Dispatcher and maintenance finish only their current short database
  transaction.
- Default idle poll interval: 500 ms.

### Migration

Create `008_retention_metrics.sql` with:

- a bounded, referentially safe cleanup function;
- queue-depth, oldest-age, lease, retry, dead-letter, handler-duration,
  stale-fence, reconciliation, and cleanup metric queries.

Retention eligibility:

- completed endpoint idempotency: 24 hours;
- dispatched events: 30 days after required jobs become terminal;
- succeeded/cancelled jobs and nonfailed attempts: 30 days;
- failed/abandoned diagnostics: 90 days;
- dead letters and unknown external operations: until resolved.

Longer-lived children retain minimal parent event/job rows.

### CI commands

Add:

- `test:integration:tenancy`
- `test:integration:durable`
- `python:test:integration`
- `worker:smoke`
- aggregate `test:integration`

CI sequence:

1. Frozen pnpm and documented Python installation.
2. `pnpm verify`.
3. `pnpm db:migrate`.
4. `pnpm test:integration`.
5. `pnpm worker:smoke`.

No MinIO, Auth0, model, object-storage, or external-provider credential is
required.

### Full final matrix

Run all preceding tests together plus:

- three worker roles independently and under `all`;
- dispatcher/executor/maintenance concurrency;
- crashes at every transaction boundary;
- executor interruption before and after grace expiry;
- multiple workers contending for jobs;
- heartbeat/reclaim/stale-worker races;
- handler-version deployment draining;
- cross-workspace claim followed by correct scoped processing;
- missing or mismatched workspace denied by predicates and forced RLS;
- cleanup racing with claims, terminal transitions, and reconciliation;
- metrics accuracy and structured-log redaction.

### 1C.5 acceptance gate

- All five slice suites pass locally and in CI.
- The final diff contains no Milestone 2A functionality.
- Documentation lists runtime commands, dependencies, safe logging, and
  recovery behavior.
- ADR-0003 remains consistent with implementation.
- No work begins on uploads, extraction, storage, retrieval, AI, artifacts, or
  UI.

## Deployment and rollback

- Apply each migration before deploying the slice that uses it.
- Start dispatcher and maintenance before executor; queued jobs are safe
  without execution.
- Deploy one artifact containing all pinned handlers.
- Scale roles independently only by command selection and replica count.
- Roll back by stopping roles and deploying a prior artifact that still
  contains every referenced handler version.
- Never down-migrate durable history or deactivate a referenced handler.
- Migration failures roll back transactionally.

## Primary risks and mitigations

- Security-definer function mistakes: fixed search paths, narrow grants,
  explicit predicates, and adversarial grants tests.
- PostgreSQL polling pressure: partial indexes, bounded batches, and metrics.
- Handler-version removal: pinned registrations, readiness checks, and
  deployment draining.
- Workloads exceeding the default lease: heartbeat metrics and future
  per-handler lease review based on measured duration.

No unresolved decision currently blocks implementation of the approved slice
sequence.
