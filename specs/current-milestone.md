# Current Milestone: Milestone 1B — Identity and Tenancy

**Status:** Approved for implementation

**Approved:** 2026-07-14

## Goal

Establish authenticated account scope and enforce workspace isolation before
private domain data is introduced.

## In scope

- Account-level users and external identities, keyed by OIDC issuer and
  subject beside Cumulore-owned internal user IDs.
- Auth0 Universal Login integration through a Cumulore-owned adapter, using
  Auth0's supported server-side OIDC flow and session mechanism.
- Workspaces, owner/member memberships, folders, and folder closure.
- Web, worker, migration, and break-glass database roles.
- Explicit workspace-scoped repositories, forced RLS, and cross-tenant tests.
- A deterministic fake identity-provider adapter for local and CI testing.

## Out of scope

- Social identity connections and any use of Auth0 Organizations, roles,
  `app_metadata`, or `user_metadata` as Cumulore authorization state.
- Manual OAuth/OIDC protocol handling, committed Auth0 credentials, and an
  application session table without a demonstrated need.
- Product domain behaviour, upload processing, retrieval, AI functionality,
  outbox events, jobs, retries, and idempotency implementation.

## Readiness gates

- ADR-0002 is accepted for PostgreSQL tenancy, RLS, and runtime roles.
- ADR-0009 is accepted for Auth0 Public Cloud in the Australia region.
- Milestone 1C remains excluded. ADR-0003 remains Proposed and is its
  readiness gate; no durable-processing implementation may begin until it is
  accepted.

## Completion criteria

- Authorized account and workspace operations succeed through the selected
  identity adapter.
- The complete cross-tenant matrix is denied by both application checks and
  PostgreSQL policies.
- Local and CI identity tests remain deterministic and do not contact Auth0.
