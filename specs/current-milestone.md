# Current Milestone: Milestone 3 — Retrieval and Citations

**Status:** First nine slices implemented and awaiting review

**Approved:** 2026-07-15

## Goal

Add structure-aware chunks, folder-scoped PostgreSQL retrieval, versioned
hybrid ranking, provenance fields, and explicit insufficient-evidence behavior
without selecting a production external embedding or model provider.

## Reviewable slices

1. **Chunking:** structure-aware, heading-aware chunks with stable checksums,
   locators, and bounded token metadata.
2. **Scope:** immutable direct/descendant folder snapshots materialized before
   retrieval.
3. **Retrieval:** indexed PostgreSQL full-text search with authorized result
   provenance and an insufficient-evidence response.
4. **Hybrid and citations:** versioned vector records, deterministic test
   embeddings, hybrid ranking, and exact chunk/locator citation validation.
5. **Reranking:** deterministic heading, token-coverage, and phrase-aware
   reranking over only the already authorized candidate set.
6. **Answer boundary:** a grounded-answer envelope that carries claims and
   citations, and converts insufficient or rejected evidence into visible safe
   statuses without invoking or publishing through a model provider.
7. **Claim support:** deterministic lexical support scoring over the cited
   authorized chunks, with conservative insufficient-evidence handling.
8. **Review proposal:** a versioned, content-hashed answer proposal envelope
   that records the retrieval snapshot and source versions, while remaining
   review-only and unable to publish over user content.
9. **Review decision:** an immutable approval/rejection decision contract that
   preserves proposal version and content hash; it cannot publish content.

## Explicit exclusions

- No production S3 adapter, malware provider, upload route, product UI, model,
  embedding provider, or question-answer generation provider.
- No OpenTelemetry SDK/backend, Redis, broker, Kafka, AWS service, Spring Boot,
  ORM, or logging framework.

## Exit gate

- `pnpm verify` and `pnpm test:integration:isolated` pass from a clean install.
- Retrieval returns only chunks inside a materialized authorized scope.
- No-match queries return explicit insufficient evidence.
- Existing 2A-H and 2B evidence remains green and is rerun after retrieval
  changes.
