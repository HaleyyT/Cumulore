# Milestone 3 — Retrieval and Citations

**Status:** First three retrieval slices implemented and awaiting review

The first three slices add deterministic structure-aware chunks, PostgreSQL
full-text retrieval, versioned synthetic embeddings, hybrid ranking,
folder-scoped snapshots, provenance-backed citation validation, and an explicit
insufficient-evidence result. Production embedding/model providers, reranking,
and external model calls remain deferred until the provider privacy, cost, and
evaluation gate.

## Guarantees

- Chunks retain source-version identity, structural type, heading context,
  locator, token count, and a server-computed checksum.
- Chunk writes are worker-only, workspace-scoped, bounded, and idempotent by
  replacing the source version's indexed chunks.
- Scope snapshots materialize only authorized direct or descendant-folder
  source versions; retrieval filters in SQL before returning text.
- Keyword search is deterministic and indexed with PostgreSQL `tsvector`.
- No authorized match returns `insufficient_evidence`; it never fabricates an
  answer or decorative citation.
- Hybrid ranking is version-aware and uses a deterministic local adapter only
  for tests; no private content leaves the application.
- Citation validation accepts only retrieved chunk IDs with exact locators.

## Deferred boundary

Reranking, question-answer generation, citation publication, and production
embedding/model provider selection remain later slices of Milestone 3.
