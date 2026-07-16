# Milestone 3 — Retrieval and Citations

**Status:** First ten retrieval slices implemented and awaiting review

The first three slices add deterministic structure-aware chunks, PostgreSQL
full-text retrieval, versioned synthetic embeddings, hybrid ranking,
folder-scoped snapshots, provenance-backed citation validation, a deterministic
candidate reranker, and an explicit grounded-answer boundary. Production
embedding/model providers and external model calls remain deferred until the
provider privacy, cost, and evaluation gate.

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
- Reranking is deterministic and can only reorder the authorized candidates
  already returned by scoped retrieval.
- The grounded-answer envelope carries validated claims and flattened citation
  references; rejected or empty evidence produces a visible safe status rather
  than answer prose.
- Claim support scoring checks meaningful claim terms against the cited chunks;
  low coverage is insufficient evidence rather than an invented conclusion.
- Answer proposals are versioned and content-hashed with their scope snapshot
  and source versions, and are marked ready for review without publication.
- Review decisions preserve the proposal version and content hash; only
  grounded proposals can be reviewed, and rejection requires an explanation.
- Publication eligibility requires grounded status, approval, and exact
  proposal ID/version/content-hash agreement; eligibility itself performs no
  write.

## Deferred boundary

Question-answer generation, citation publication, and production embedding/model
provider selection remain later slices of Milestone 3. The current proposal and
review decision are
a contract boundary only; it does not call a model, persist an artifact, or
overwrite user-managed content.
