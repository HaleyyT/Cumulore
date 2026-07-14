# Current Milestone: Milestone 3 — Retrieval and Citations

**Status:** First slice implemented and awaiting review

**Approved:** 2026-07-15

## Goal

Add structure-aware chunks, folder-scoped PostgreSQL retrieval, provenance
fields, and explicit insufficient-evidence behavior without selecting an
external embedding or model provider.

## Reviewable slices

1. **Chunking:** structure-aware, heading-aware chunks with stable checksums,
   locators, and bounded token metadata.
2. **Scope:** immutable direct/descendant folder snapshots materialized before
   retrieval.
3. **Retrieval:** indexed PostgreSQL full-text search with authorized result
   provenance and an insufficient-evidence response.

## Explicit exclusions

- No production S3 adapter, malware provider, upload route, product UI, model,
  embedding provider, reranking, or question-answer generation.
- No OpenTelemetry SDK/backend, Redis, broker, Kafka, AWS service, Spring Boot,
  ORM, or logging framework.

## Exit gate

- `pnpm verify` and `pnpm test:integration:isolated` pass from a clean install.
- Retrieval returns only chunks inside a materialized authorized scope.
- No-match queries return explicit insufficient evidence.
- Existing 2A-H and 2B evidence remains green and is rerun after retrieval
  changes.
