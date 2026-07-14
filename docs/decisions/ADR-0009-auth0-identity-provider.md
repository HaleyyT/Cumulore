# ADR-0009: Auth0 Identity Provider and Identity Boundary

- **Status:** Accepted
- **Date:** 2026-07-14
- **Accepted:** 2026-07-14
- **Decision owners:** Product and engineering

## Context

Cumulore needs managed authentication before it can introduce account and
workspace scope. The product must retain control of its internal users,
workspaces, memberships, roles, and authorization decisions while allowing
additional identity connections later without changing its identity model.

## Decision

Use Auth0 Public Cloud in the Australia region for staging and production.
Use Auth0 Universal Login and initially enable only the Auth0 database
email/password connection for the private alpha. Google and other social
connections are deferred.

The Next.js application will use the official Auth0-supported SDK behind a
Cumulore-owned identity-provider adapter. It relies on the supported
server-side OIDC authorization flow and secure server-side session mechanism;
it does not implement OAuth/OIDC protocol handling manually or add a
database-backed application session table unless a later Milestone 1B plan
demonstrates a need beyond that mechanism.

Cumulore creates and owns internal user IDs. An external identity is uniquely
identified by the pair of OIDC issuer and subject. Email is mutable profile
data and is never the permanent external identity key.

Auth0 Organizations, roles, `app_metadata`, and `user_metadata` are not the
source of truth for Cumulore workspaces, memberships, roles, or authorization.
Those records and decisions remain in Cumulore's PostgreSQL database and are
enforced by application checks and row-level security.

Local development and CI use a deterministic fake identity-provider adapter
and do not contact Auth0. No Auth0 credentials are committed; real values are
kept in ignored local environment files and deployed secret storage.

## Consequences

- Social connections can be added without changing the internal identity key.
- Authentication is provider-backed while tenant authorization remains under
  Cumulore control.
- Tests are deterministic and network-independent.
- The adapter is the only application boundary coupled to the Auth0 SDK.

## Reconsider when

- Auth0 no longer meets Australia-region, privacy, availability, or cost
  requirements.
- A supported integration cannot meet Cumulore's server-side session or
  security requirements.
