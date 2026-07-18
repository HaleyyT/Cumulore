# Private-Alpha Operations Runbook

**Status:** Milestone 2A-H baseline

## Signals

The worker-only `app.operational_metrics()` function returns queue depth and
age, running/expired/dead-letter jobs, ingestion states, database connections,
lock waits, and longest transaction age. Maintenance logs these aggregate,
low-cardinality values. Durable event/job IDs and correlation IDs may appear in
diagnostic logs; user/workspace IDs and source metadata may not.

## Queue growth

1. Compare queue depth with oldest age. A brief depth increase without age
   growth is normal burst absorption.
2. Check running jobs, expired leases, dead letters, database connections, and
   lock waits.
3. Verify dispatcher and executor processes are alive and handler versions are
   deployed before increasing concurrency.
4. Inspect normalized query statistics and claim/dispatch plans. Tune queries
   and bounded batch/concurrency limits before adding infrastructure.

Little's Law provides the capacity model: average queued work is arrival rate
multiplied by time in the system. Increase capacity only after measuring both
arrival rate and handler duration.

## Expired or stuck leases

1. Confirm the owning worker is unavailable or past its lease; never mutate a
   running job directly.
2. Allow migration-owned maintenance reclaim to abandon the attempt and advance
   the lease generation.
3. Treat stale-fence rejection as healthy protection. Do not force a stale
   worker result into history.
4. Investigate repeated expiry by handler duration, database waits, shutdown
   timing, and heartbeat behavior.

## Unknown external outcomes

1. Do not invoke the provider again while an operation is `in_flight` or
   `unknown`. A missing response is not proof that the provider performed no
   effect.
2. Maintenance converts an abandoned `prepared` operation to the safe
   `invocation_not_started` failure, while an abandoned `in_flight` operation
   becomes `unknown` and is scheduled for reconciliation.
3. Reconciliation claims are bounded, leased, generation-fenced, and return the
   authoritative workspace. A stale owner or generation cannot publish a
   result.
4. Resume the job only after reconciliation records confirmed success or
   confirmed failure. A confirmed success completes through the matching
   logical-operation fence without invoking the provider again.
5. A provider without idempotency or reconciliation support must enter an
   actionable dead letter; never implement a blind retry. The current runtime
   exercises this policy only with a deterministic fake provider.

## Migration failure

1. Stop application rollout; do not edit `schema_migrations` manually.
2. Confirm the failed migration transaction rolled back. The migration runner
   holds a database-scoped advisory lock and verifies the SHA-256 checksum and
   byte size of every applied migration; a mismatch is a release blocker, not
   a reason to rewrite migration history.
3. Capture the safe migration name/error class without credentials or private
   rows.
4. Correct with a forward migration. Never down-migrate durable history.
5. Re-run the isolated integration command from an empty database and the
   supported previous schema state before retrying deployment.

## Database saturation or lock waits

1. Stop increasing replicas or worker concurrency.
2. Check connection budget, longest transaction, lock waits, and normalized
   high-total-time queries.
3. Cancel only an identified safe non-critical query using audited database
   administration; do not terminate migrations without understanding rollback.
4. Restore headroom, then address transaction scope, indexes, batch size, or
   pool configuration. A cache or broker requires a separate evidence-backed
   decision.

## Extraction failure

1. Use the source terminal state and safe failure code; do not inspect or copy
   source content into logs.
2. Confirm content type, declared/server size, hash, parser version, and quality
   counts from authorized workspace-scoped records.
3. Unsupported, malformed, encrypted, empty, or oversized content remains an
   actionable failure. Never convert it into empty success.
4. Retry only when the failure classification and idempotency boundary permit
   it. Unknown external outcomes must reconcile before another invocation.

## Recovery verification

- Run `pnpm test:integration:isolated` after migration, role, RLS, queue, or
  ingestion changes.
- Run the synthetic baseline on the same documented reference environment when
  changing critical indexes, queries, pooling, or job batch behavior.
- Before staging, add restore drills, telemetry backend alerts, retention
  approvals, and provider-specific incident procedures.
