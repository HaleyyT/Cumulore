# Milestone 2A-H — Operational Foundation and Performance Baseline

**Status:** Accepted at the local/private-alpha boundary

**Approved:** 2026-07-15

**Accepted:** 2026-07-15

This bounded hardening milestone sits between the first ingestion slice and
DOCX/PPTX support. It improves proof, security, and operability without adding
product behavior or selecting a production provider.

## Guarantees

- A clean PostgreSQL/pgvector environment can be created, migrated, tested, and
  destroyed through one command used locally and in CI.
- Runtime repositories retain explicit actor/workspace context and PostgreSQL
  forced RLS remains the final database boundary.
- Upload metadata is rejected before database work when identifiers, format,
  content type, size, title, digest, or expiry violate the approved contract.
- Future state-changing browser handlers have a reusable fail-closed origin
  check; authentication and authorization remain additional mandatory checks.
- Operational records use a bounded allow-list and never accept source content,
  filenames, URLs, credentials, tokens, cookies, or arbitrary error text.
- Performance runs use synthetic data, roll their transaction back, and write
  machine-specific evidence only under ignored `.local/` storage.

## Technology boundary

`@testcontainers/postgresql` is the only added dependency. It is development-
only and supplies clean PostgreSQL lifecycle management that the Node standard
library and the existing externally provisioned database command do not
provide. Its transitive optional native build scripts remain disabled because
the local Docker transport does not require them.

No telemetry backend, logging framework, cache, broker, cloud SDK, ORM, or
production storage client is introduced.

## Acceptance evidence

- Unit tests: upload validation, trusted origin, TypeScript/Python structured
  logging, contract fixtures, identity, storage traversal, and extraction.
- Integration tests: migrations, tenant denial, durable processing, ingestion,
  aggregate metric ownership/grants, and worker smoke.
- Operational review: query catalogue, connection budget, timeout policy,
  performance command, signal definitions, and recovery playbooks.
