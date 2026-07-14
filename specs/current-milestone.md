# Current Milestone: Milestone 2A-H — Operational Foundation and Performance Baseline

**Status:** Implemented and awaiting review

**Approved:** 2026-07-15

## Goal

Harden the accepted first ingestion foundation through reproducible PostgreSQL
integration, explicit TypeScript and browser trust boundaries, redacted
operational signals, and repeatable performance evidence before adding more
formats or providers.

## Reviewable slices

1. **PostgreSQL production depth:** query catalogue, forced-RLS review,
   migration checks, connection/timeout budgets, aggregate metrics, and a
   synthetic local baseline.
2. **Reproducible integration:** a pinned Testcontainers PostgreSQL/pgvector
   environment runs fresh migrations, TypeScript/Python integration, and the
   worker smoke path through one local/CI command.
3. **TypeScript and API security:** validated upload inputs, safe typed errors,
   and a same-origin policy for future state-changing route handlers.
4. **Observability and operations:** vendor-neutral structured logs,
   correlation fields, low-cardinality metrics, and recovery runbooks.

## Explicit exclusions

- No DOCX/PPTX, production S3 adapter, malware provider, upload route, product
  UI, model, embedding, retrieval, or other Milestone 2B+ functionality.
- No OpenTelemetry SDK/backend, Redis, broker, Kafka, AWS service, Spring Boot,
  ORM, or logging framework.
- Testcontainers is development-only. MinIO remains the interactive local
  interface until a real S3-compatible adapter exists.

## Exit gate

- `pnpm verify` and `pnpm test:integration:isolated` pass from a clean install.
- The isolated command enables pgvector and local-only `pg_stat_statements`,
  migrates from zero, and exercises RLS, jobs, ingestion, metrics, Python, and
  worker smoke behavior.
- Operational logs and metrics contain bounded control metadata only.
- Query and performance evidence is documented without machine-specific timing
  output entering version control.
- Milestone 2B remains blocked until this milestone receives review approval.
