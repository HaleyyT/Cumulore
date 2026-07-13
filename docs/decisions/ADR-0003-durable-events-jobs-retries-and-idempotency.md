# ADR-0003: Durable Events, Jobs, Retries, and Idempotency

- **Status:** Proposed
- **Date:** 2026-07-13
- **Decision owners:** Product and engineering
- **Readiness gate:** Must be reviewed and accepted before Milestone 1C
  implementation

## Context

Uploads, extraction, indexing, generation, deletion, and exports continue after
an HTTP request ends. Work may be delivered more than once, a worker may stop
mid-operation, and external providers may return an uncertain result. Users
must see either durable success or an actionable failure without duplicate
artifacts or destructive repeated effects.

## Decision

### Events and dispatch

A product command writes domain state and an append-only outbox event in the
same PostgreSQL transaction. Events are facts and use an unversioned
`event_type`, such as `source.upload.finalized`, together with a numeric
`schema_version`, such as `1`.

Every event envelope contains:

- `event_id`;
- `event_type`;
- `schema_version`;
- `occurred_at`;
- `workspace_id` for workspace-owned events;
- actor, correlation, and causation identifiers;
- identifier-only, non-sensitive payload data.

Event payloads never include source text, prompts, model output, credentials,
access tokens, cookies, or signed URLs.

A dispatcher materializes one job for each registered handler. Job names are
unversioned imperatives, such as `extract_source`, and use a separate numeric
`handler_version`. A unique constraint on
`(event_id, handler_name, handler_version)` prevents duplicate dispatch.

### Claiming and delivery

Workers claim due jobs in PostgreSQL with `FOR UPDATE SKIP LOCKED`. A claim
records the worker identity and a bounded lease expiry. Delivery is at least
once: expired leases may be reclaimed, so handlers must be idempotent.

Job states are `pending`, `running`, `retry_wait`, `succeeded`, `dead_letter`,
and `cancelled`. User-facing domain state may separately be `action_required`;
it is not a job transport state.

Each execution creates an immutable attempt record with start/end timestamps,
safe error code, retry classification, and usage metadata. Manual retry creates
a new linked attempt and preserves history.

### Idempotency

- Retryable public commands use an `Idempotency-Key` scoped by actor and
  operation.
- The stored record includes a request hash and prior response. Reusing a key
  with a different request is rejected.
- Handler effects use a deterministic operation key derived from input version,
  handler version, parser/model/prompt/config versions, and destination.
- Result creation and job completion occur in one database transaction where
  possible.
- External side effects record an attempt before invocation, pass a provider
  idempotency key when supported, and reconcile uncertain outcomes before
  another invocation.

### Retries and terminal failure

Retries use exponential backoff with jitter, a bounded maximum attempt count,
and explicit retryable/non-retryable error classification. Exhausted or
non-retryable work enters `dead_letter` with a safe user-visible failure or
action. Cancellation is recorded and does not erase attempts or events.

Queue depth, oldest-job age, lease expiry, retry count, dead-letter count, and
handler duration are monitored. PostgreSQL remains the queue until measured
load or an availability requirement justifies a broker.

## Consequences

- Domain state and the event requesting follow-up work cannot diverge at the
  transaction boundary.
- Consumers must support schema compatibility and duplicate delivery.
- PostgreSQL queue load must be measured and retained data pruned safely.
- The event envelope permits a later broker without changing domain semantics.

## Reconsider when

- Queue traffic measurably harms transactional database latency.
- Independent availability or cross-region delivery is required.
- A workflow requires orchestration semantics that cannot be represented safely
  by explicit jobs and state machines.
