# Milestone 3 — Retrieval and Citations

**Status:** First slice implemented and awaiting review

This first slice adds deterministic structure-aware chunks, PostgreSQL
full-text retrieval, folder-scoped snapshots, and an explicit insufficient-
evidence result. Semantic embeddings, reranking, and external model calls
remain deferred until the provider privacy, cost, and evaluation gate.

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

## Deferred boundary

`pgvector` columns, embedding adapters, reranking, question-answer generation,
claim validation, and citation publication are later slices of Milestone 3.
No model or embedding provider is selected by this implementation.
