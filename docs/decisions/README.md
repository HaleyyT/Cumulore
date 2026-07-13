# Architecture Decision Records

ADRs capture decisions that are expensive to reverse or affect contracts,
security, persistence, or deployment. Use `Proposed`, `Accepted`, `Superseded`,
or `Rejected` status. A proposed ADR is not implementation authority until it
is accepted.

## Register

| ADR | Status | Decision |
| --- | --- | --- |
| [ADR-0001](ADR-0001-application-architecture.md) | Accepted | Application architecture and deployment shape |
| [ADR-0002](ADR-0002-postgresql-tenancy-rls-and-runtime-roles.md) | Proposed | PostgreSQL tenancy, RLS, and runtime roles |
| [ADR-0003](ADR-0003-durable-events-jobs-retries-and-idempotency.md) | Proposed | Durable events, jobs, retries, and idempotency |
| ADR-0004 | To create | Artifact blocks, ownership, proposals, and versioning |
| ADR-0005 | To create | Folder inheritance and immutable source-scope snapshots |
| ADR-0006 | To create | Retrieval, chunking, and citation provenance |
| ADR-0007 | To create | Authentication, authorization, export, and deletion |
| ADR-0008 | To create | Environment isolation and production deployment provider |

ADR-0002 and ADR-0003 must be accepted before their affected implementation
begins. Each later ADR should likewise be accepted before its affected
milestone.
