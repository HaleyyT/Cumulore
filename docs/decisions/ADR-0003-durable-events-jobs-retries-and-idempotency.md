# ADR-0003: Durable Events, Jobs, Retries, and Idempotency

- **Status:** Accepted
- **Date:** 2026-07-13
- **Amended:** 2026-07-14 after architecture review
- **Accepted:** 2026-07-14
- **Decision owners:** Product and engineering

## Context

Uploads, extraction, indexing, generation, deletion, and exports continue after
an HTTP request ends. Work may be delivered more than once, a worker may stop
mid-operation, and external providers may return an uncertain result. Users
must see either durable success or an actionable failure without duplicate
artifacts or destructive repeated effects.

## Decision

### Events and transactional dispatch

A product command writes its domain state and an append-only outbox event in
the same PostgreSQL transaction. A rollback therefore persists neither the
domain mutation nor its event.

Events are facts. They use an unversioned `event_type`, such as
`source.upload.finalized`, with a numeric `schema_version`, such as `1`. Every
event envelope contains:

- `event_id`;
- `event_type`;
- `schema_version`;
- `occurred_at` as a UTC RFC3339 timestamp;
- non-null `workspace_id` for a workspace-owned event, or null only for an
  approved account-level or global operational event;
- an actor with `type` equal to `user`, `system`, or `worker`; `id` is required
  for user and worker actors and may be null for a system actor;
- a required correlation identifier and a nullable causation identifier;
- identifier-only, non-sensitive payload data.

Event payloads never include source text, prompts, model output, credentials,
access tokens, cookies, or signed URLs. Published schemas identified by
`(event_type, schema_version)` are immutable. Producers validate before writing
an event, consumers validate before handling it, and every consumer declares
the event types and schema versions it supports.

A dispatcher selects a configurable, bounded batch of undispatched events in
deterministic `(occurred_at, event_id)` order with
`FOR UPDATE SKIP LOCKED`. It resolves the active handlers, creates every
applicable job, and records dispatch completion in one short transaction. The
transaction performs no network or external-provider operation. A unique
constraint on `(event_id, handler_name, handler_version)` makes dispatch safe
to retry after a crash or duplicate selection.

Job names are unversioned imperatives, such as `extract_source`, with a
separate numeric `handler_version`. New dispatches use the active version.
Existing jobs remain pinned to their original version, and that implementation
must remain available while any nonterminal job references it. Activating a
new version never replays historical events; replay or backfill is an explicit,
separately authorized operation.

### Atomic claim protocol, leases, and workspace scope

Workers claim jobs through a narrowly scoped, migration-owned PostgreSQL claim
function. The function has a fixed safe search path, is executable only by the
worker role, and does not give that role general cross-workspace table access
or `BYPASSRLS`.

The function uses PostgreSQL time and selects at most 10 eligible jobs in
deterministic `(available_at, created_at, job_id)` order. In one short
transaction it:

1. locks eligible rows with `FOR UPDATE SKIP LOCKED`;
2. changes each claimed job to `running`;
3. creates an immutable attempt record;
4. increments the job's `lease_generation`;
5. records the worker owner and a lease expiry 60 seconds from database time;
6. returns identifier-only job metadata, authoritative `workspace_id`,
   `attempt_id`, lease generation, and lease expiry.

The migration revokes claim-function execution from `PUBLIC` and grants
`EXECUTE` only to the worker runtime role.

The claim transaction ends before handler execution. A running worker renews
its lease every 20 seconds. Renewal, completion, failure, cancellation
acknowledgement, effect publication, and result persistence must atomically
match the job ID, current attempt, worker owner, `running` state, and lease
generation. Reclaim increments the generation, so a stale worker cannot commit
after another worker reclaims its job.

Every processing transaction independently sets the authoritative claimed
workspace through transaction-local settings and includes explicit workspace
predicates. Forced RLS and the worker grants from ADR-0002 remain in effect.
No database transaction remains open while a handler performs computation or
an external call.

### Job state machine and attempts

The only job states are `pending`, `running`, `retry_wait`, `succeeded`,
`dead_letter`, and `cancelled`. Legal transitions are:

| From          | To            | Cause                                                           |
| ------------- | ------------- | --------------------------------------------------------------- |
| `pending`     | `running`     | Atomic claim                                                    |
| `pending`     | `cancelled`   | Authorized cancellation before claim                            |
| `retry_wait`  | `running`     | Atomic claim after `available_at`                               |
| `retry_wait`  | `cancelled`   | Authorized cancellation before reclaim                          |
| `running`     | `succeeded`   | Fenced effect and completion transaction                        |
| `running`     | `retry_wait`  | Fenced retryable failure or expired lease with budget remaining |
| `running`     | `dead_letter` | Non-retryable failure or exhausted attempt budget               |
| `running`     | `cancelled`   | Cooperative cancellation commits before completion              |
| `dead_letter` | `pending`     | Authorized, audited manual retry                                |

`succeeded` and `cancelled` are terminal. A dead letter remains terminal unless
an authorized manual retry requeues it.

`action-required` is a product-visible outcome backed by a `dead_letter` or an
unresolved external-operation state; it is not an additional job state.

Each claim creates an immutable attempt with start and end timestamps, retry
generation, safe error code, retry classification, usage metadata, and an
outcome. When a lease expires, the reclaim path atomically closes the prior
attempt as `abandoned`. The abandoned attempt consumes retry budget. The job
moves to jittered `retry_wait`, or to `dead_letter` when its applicable budget
is exhausted.

Pending jobs may be cancelled directly. Running jobs instead receive
`cancel_requested_at`; handlers check it before expensive or external work and
before committing an effect. If fenced success commits first, success remains
final. If cancellation commits first, the later completion fails its state and
fencing check. Cancellation does not reverse an already confirmed external
effect and does not erase attempts or events.

### Endpoint and job-effect idempotency

Retryable public commands use an `Idempotency-Key` scoped by workspace when
applicable, actor, operation or route, and key. The record stores a canonical
request hash, processing or completed status, a safe response status and body
or stable response reference, and expiry.

- The same key and hash replays a completed result or reports that processing
  is still in progress.
- The same key with a different hash returns a conflict and performs no domain
  mutation.
- For database-only commands, the idempotency state, domain mutation, outbox
  event, and completed response persist in one transaction.
- Completed records are retained for 24 hours by default.
- Records never retain credentials, tokens, signed URLs, sensitive source
  content, or other secrets.

Handler effects use a database-enforced unique key containing workspace,
operation, destination, input version, handler version, and configuration
version. For a database-only handler, effect persistence, attempt completion,
and transition to `succeeded` occur in one fenced transaction.

### External-operation state machine

External operations use `prepared`, `in_flight`, `succeeded`, `failed`, and
`unknown` states. Their legal transitions are:

| From        | To          | Cause                                                                        |
| ----------- | ----------- | ---------------------------------------------------------------------------- |
| `prepared`  | `in_flight` | Stable provider key is committed before invocation                           |
| `in_flight` | `succeeded` | Provider success is confirmed                                                |
| `in_flight` | `failed`    | Provider failure is confirmed                                                |
| `in_flight` | `unknown`   | Timeout, lost connection, or worker interruption makes the outcome ambiguous |
| `unknown`   | `succeeded` | Reconciliation confirms success                                              |
| `unknown`   | `failed`    | Reconciliation confirms failure or that no effect occurred                   |

`succeeded` and `failed` are terminal for that external-operation record. A
safe retry creates a linked operation record and reuses the stable provider
idempotency key.

Before invocation, the worker commits an operation record and its stable
provider idempotency key. It then performs the call without an open database
transaction and records the confirmed result in a later fenced transaction.

A timeout, lost connection, or worker crash after invocation can leave the
operation `unknown`. Unknown outcomes must be reconciled with the same provider
key before another invocation. If a provider supports neither idempotency nor
outcome reconciliation, the operation cannot be retried automatically and the
job enters a safe dead-letter or action-required path. Milestone 1C implements
and tests this boundary only through a deterministic fake provider.

### Automatic and manual retries

An automatic-attempt budget includes the initial execution. Each retry
generation permits at most 5 automatic attempts, while a logical job has a hard
system cap of 10 lifetime attempts across all generations. Retryable failures
use full-jitter exponential backoff calculated from PostgreSQL time:

`uniform(0, min(15 minutes, 5 seconds * 2^(generation attempt - 1)))`

Non-retryable failures, exhausted generation budgets, and exhausted lifetime
budgets enter `dead_letter`.

Only an actor authorized for the original operation may manually retry a
dead-letter job. Manual retry requeues the same logical job, increments
`retry_generation`, preserves `handler_version`, and records actor, reason, and
timestamp. It creates no attempt until the next successful claim. An atomic
state check rejects concurrent manual retries, and the lifetime hard cap still
applies.

### Retention and cleanup

Retention durations define earliest cleanup eligibility; referential or audit
dependencies may require longer retention:

| Record                                           | Default retention                            |
| ------------------------------------------------ | -------------------------------------------- |
| Completed endpoint-idempotency record            | 24 hours                                     |
| Safely dispatched event                          | 30 days after every required job is terminal |
| Succeeded or cancelled job and nonfailed attempt | 30 days                                      |
| Failed or abandoned attempt diagnostics          | 90 days                                      |
| Dead letter                                      | Until explicitly resolved                    |
| Unresolved or unknown external operation         | Until explicitly resolved                    |

Cleanup uses bounded batches, exposes deleted and deferred counts, and never
removes a record that a retained child still references. Minimal parent event
or job records remain while a longer-lived attempt, dead letter, or external
operation depends on them.

### Required Milestone 1C tests

Integration tests use real PostgreSQL with forced RLS and cover:

- command rollback and commit at the domain/outbox boundary;
- concurrent dispatchers, duplicate event selection, dispatcher crashes, and
  handler-job uniqueness;
- producer and consumer schema validation and unsupported schema versions;
- deterministic bounded claims, locked-row skipping, and concurrent workers;
- claim/attempt atomicity and crashes at every claim, effect, and completion
  transaction boundary;
- heartbeat renewal, expiry, reclaim, abandoned attempts, and stale-worker
  completion or effect rejection;
- retry classification, full-jitter bounds, generation exhaustion, lifetime
  exhaustion, and non-retryable failure;
- concurrent endpoint requests with matching and conflicting hashes;
- duplicate job-effect keys and fenced database-only completion;
- pending and running cancellation racing with claim, heartbeat, completion,
  and lease reclaim;
- active and pinned handler versions, deployment draining, and explicit replay;
- authorized, unauthorized, and concurrent manual retries;
- fake-provider success, failure, unknown outcome, reconciliation, and the
  no-idempotency/no-reconciliation prohibition;
- worker claims across two workspaces followed by workspace-scoped processing,
  including missing and mismatched context denial by explicit predicates and
  forced RLS;
- bounded cleanup preserving live references, dead letters, failed diagnostics,
  and unresolved external operations.

Queue depth, oldest-job age, claim latency, lease expiry, retry count,
dead-letter count, handler duration, stale-worker rejection, reconciliation,
and cleanup counts are monitored. PostgreSQL remains the queue until measured
load or an availability requirement justifies a broker.

## Consequences

- Domain state and the event requesting follow-up work cannot diverge at the
  transaction boundary.
- Delivery is at least once. Idempotency keys and lease fencing, not an
  exactly-once claim, prevent duplicate durable effects.
- Consumers must support declared schema versions and duplicate delivery.
- Worker queue claims are cross-workspace only through the narrow claim
  function; processing remains workspace-scoped under forced RLS.
- Old handler versions must remain deployable until their jobs drain.
- PostgreSQL queue load and retained data must be measured and pruned safely.
- The event envelope permits a later broker without changing domain semantics.

## Reconsider when

- Queue traffic measurably harms transactional database latency.
- Independent availability or cross-region delivery is required.
- A workflow requires orchestration semantics that cannot be represented safely
  by explicit jobs and state machines.
