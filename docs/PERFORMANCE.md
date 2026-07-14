# PostgreSQL and Performance Baseline

**Status:** Milestone 2A-H operational baseline

Performance decisions are evidence-driven. Shared CI proves deterministic
correctness, indexing, isolation, and clean setup; it does not fail on host-
dependent wall-clock timing. Reference-environment runs write their detailed
results to ignored `.local/operational-baseline.json`.

## Query catalogue

| Boundary                     | Owner/role                       | Transaction                       | Expected cardinality           | Tenant predicate and supporting index                |
| ---------------------------- | -------------------------------- | --------------------------------- | ------------------------------ | ---------------------------------------------------- |
| Provision external identity  | Web via migration-owned function | One short account command         | One identity                   | Issuer/subject unique key; account-scoped            |
| Create workspace and owner   | Web via function                 | One atomic command                | One workspace/member           | New workspace ID; membership primary key             |
| Read workspace               | Web repository                   | Actor transaction                 | Zero or one                    | Explicit workspace ID plus forced RLS                |
| Add member                   | Web via function                 | One command                       | One member                     | Current workspace and owner membership PK            |
| Create folder/closure        | Web repository                   | One command                       | Ancestor depth                 | Workspace plus closure PK/composite FKs              |
| Append outbox event          | Web application command          | Same transaction as domain change | One event                      | Workspace/event composite key and correlation index  |
| Dispatch outbox              | Worker function                  | Bounded batch, maximum 100        | Zero to 100 events             | Partial undispatched `(occurred_at,id)` index        |
| Claim jobs                   | Worker function                  | Bounded batch, maximum 10         | Zero to 10 jobs                | Partial `(available_at,created_at,id)` claim index   |
| Lease/transition/effect      | Worker functions                 | One fenced attempt                | One job/attempt/effect         | Workspace/job composite keys and lease generation    |
| Endpoint idempotency         | Web command                      | Same transaction as effect        | Zero or one record             | Workspace/actor/operation/key uniqueness             |
| Reconcile external operation | Maintenance function             | Bounded batch                     | Zero to 10 operations          | Partial due-reconciliation index                     |
| Cleanup durable history      | Maintenance function             | Bounded batch, maximum 100        | Zero to 100 parents            | Partial expiry/terminal indexes                      |
| Create upload session        | Web function                     | One command                       | One source/version/session     | Workspace/folder composite FK; session expiry index  |
| Finalize upload              | Web function                     | One command                       | One session/event              | Workspace/session unique key; actor predicate        |
| Exact duplicate lookup       | Worker function                  | Source validation transaction     | Zero or one match              | Partial `(workspace_id,sha256)` index                |
| Record extraction            | Worker function                  | One source completion             | Elements in one source version | Composite source-version and element ordinal indexes |
| Operational metrics          | Worker-only function             | One aggregate snapshot            | One row                        | Low-cardinality partial indexes; no tenant labels    |

No application transaction may remain open during object transfer, extraction,
model/provider calls, or other unbounded work.

## Connection and timeout policy

- The TypeScript pool defaults to at most 10 connections per process, five-
  second connection acquisition, and 30-second idle release.
- Worker executor concurrency remains one. Dispatcher, executor, and
  maintenance use short independent connections and transactions.
- Deployment planning must satisfy:
  `(web replicas × web pool) + worker role connections + migration/admin reserve
<= 80% of PostgreSQL max_connections`.
- Keep at least 20% for migrations, administration, monitoring, and recovery.
- Interactive performance investigation uses a five-minute statement timeout
  and two-second lock timeout. Runtime command-specific timeouts must be shorter
  than user-visible or lease deadlines when introduced.

## Repeating the baseline

On an isolated or disposable migrated database:

```sh
CUMULORE_ALLOW_SYNTHETIC_BASELINE=1 DATABASE_URL=postgresql://... pnpm perf:baseline
```

The script creates 10,000 synthetic outbox events inside one transaction,
measures bounded dispatch and claim calls, captures an analyzed buffer-aware
claim plan, then rolls back. Soft investigation budgets are 100 ms p95 for a
100-event dispatch batch and a single claim. A miss is evidence to inspect the
plan and host load, not an automatic CI failure.

Local PostgreSQL preloads `pg_stat_statements`; create the extension only in
local or staging-style databases. Use it to rank normalized queries by total
and mean execution time, then correlate with queue age, connection use, lock
waits, and workload changes. Do not store query text that may contain private
literals in application telemetry.

## Evolution gates

- Add a cache only after a repeated read workload has a measured hit-rate
  opportunity and an explicit staleness/invalidation policy.
- Add a broker only if indexed bounded PostgreSQL queue operations remain a
  meaningful database load or availability coupling.
- Add Kafka only for required durable replay, high throughput, or multiple
  independently evolving consumers.
- Select hosting and AWS services only after database, storage, worker,
  networking, regional, security, and recovery measurements exist.
