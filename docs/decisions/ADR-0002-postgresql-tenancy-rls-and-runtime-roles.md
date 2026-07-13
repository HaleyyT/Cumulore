# ADR-0002: PostgreSQL Tenancy, RLS, and Runtime Roles

- **Status:** Proposed
- **Date:** 2026-07-13
- **Decision owners:** Product and engineering
- **Readiness gate:** Must be reviewed and accepted before Milestone 1B
  implementation

## Context

Cumulore stores account data and private workspace content in one PostgreSQL
database. Application mistakes must not join, read, mutate, retrieve, or expose
one workspace's content from another workspace. At the same time, account-level
identity records do not naturally belong to a workspace.

## Decision

### Data scopes

`users`, `external_identities`, and `sessions` are account-level tables. They do
not contain `workspace_id` and are accessed only through authenticated-account
application services and narrow database grants.

Every workspace-owned domain table contains a non-null `workspace_id`.
`workspace_members` connects an account-level `user` to a `workspace` and is
the authorization boundary between account and workspace scopes.

Workspace-owned relationships use composite uniqueness and foreign keys on
`(workspace_id, id)` where applicable. This prevents records in one workspace
from referencing records in another even if application code supplies an
incorrect identifier.

### Authorization and row-level security

Application queries must include an explicit workspace predicate. PostgreSQL
row-level security is an additional defense, not a replacement for application
authorization.

- Enable and force RLS on every workspace-owned domain table.
- Set the authenticated user and selected workspace as transaction-local
  context for web requests.
- Web policies require both the selected workspace and an active membership for
  the authenticated user.
- Account-level access must match the authenticated user or a narrowly defined
  owner/admin operation.
- Worker transactions set the workspace assigned by the claimed job. Worker
  grants are restricted to processing tables and approved reads/writes.
- `workspace_members` permits users to read their own memberships; membership
  management requires an owner authorization path.

### Runtime roles

- **Web role:** reads account data needed for the authenticated session and
  reads/writes authorized workspace-owned product data.
- **Worker role:** claims jobs and accesses only processing data needed for the
  job's workspace. It cannot change membership, block ownership, published
  artifact state, or deletion authority.
- **Migration role:** owns schema objects and applies reviewed migrations. It is
  never used by a running application.
- **Break-glass role:** disabled for normal operation, separately credentialed,
  time-bounded when activated, and audited.

Runtime roles must not own protected tables and must not have `BYPASSRLS`.

### Testing requirements

Integration tests run against PostgreSQL with RLS enabled and forced. For each
workspace-owned repository and public operation, tests cover:

- authorized access in the selected workspace;
- a valid record ID from a different workspace;
- missing or mismatched workspace context;
- inactive or absent membership;
- cross-workspace insert and relationship attempts;
- worker access outside the claimed job workspace.

Both application rejection and database denial are asserted where applicable.

## Consequences

- Tenant scope is visible in repository interfaces, constraints, indexes, and
  tests rather than being an implicit convention.
- Account deletion and workspace deletion remain separate workflows.
- Composite keys add migration and query verbosity but prevent an important
  class of cross-workspace integrity defects.
- Worker access remains least-privilege even though web and worker share one
  database.

## Reconsider when

- A customer requires a dedicated database or regional isolation.
- Folder-level permissions require a finer authorization model.
- Measured scale requires partitioning or separating processing storage.
