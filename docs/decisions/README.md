# Architecture Decision Records

ADRs capture decisions that are expensive to reverse or affect contracts,
security, persistence, or deployment. Use `Proposed`, `Accepted`, `Superseded`,
or `Rejected` status. A proposed ADR is not implementation authority until it
is accepted.

## Register

| ADR | Status | Decision |
| --- | --- | --- |
| [ADR-0001](ADR-0001-application-architecture.md) | Accepted | Application architecture and deployment shape |
| [ADR-0002](ADR-0002-postgresql-tenancy-rls-and-runtime-roles.md) | Accepted | PostgreSQL tenancy, RLS, and runtime roles |
| [ADR-0003](ADR-0003-durable-events-jobs-retries-and-idempotency.md) | Accepted | Durable events, jobs, retries, and idempotency |
| ADR-0004 | To create | Artifact blocks, ownership, proposals, and versioning |
| ADR-0005 | To create | Folder inheritance and immutable source-scope snapshots |
| ADR-0006 | To create | Retrieval, chunking, and citation provenance |
| ADR-0007 | To create | Authentication, authorization, export, and deletion |
| ADR-0008 | To create | Environment isolation and production deployment provider |
| [ADR-0009](ADR-0009-auth0-identity-provider.md) | Accepted | Auth0 identity provider and identity boundary |
| [ADR-0010](ADR-0010-source-locators-and-pdf-parser.md) | Proposed | Versioned source locators and PDF parser boundary |

ADR-0002 is accepted for Milestone 1B and ADR-0003 is accepted for Milestone
1C. Each later ADR should likewise be accepted before its affected milestone.

ADR-0003 was amended and accepted after architecture review on 2026-07-14.
