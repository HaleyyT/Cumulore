# Milestone 2A — First Ingestion Vertical Slice

**Status:** Accepted at the local/private-alpha boundary

**Accepted:** 2026-07-15

This slice establishes the first authorized ingestion path for PDF, TXT, and
pasted text. It deliberately stops before DOCX/PPTX, malware-provider
integration, object-storage selection, extraction chunking, retrieval, and any
model or product automation work.

## Guarantees

- Upload sessions and source versions are workspace-scoped and protected by
  forced RLS.
- Quarantine keys are generated server-side, immutable, and cannot escape the
  configured storage root in the local adapter.
- Finalization validates expiry and declared size, then emits a versioned
  `source.upload.finalized` event exactly once per session.
- Server-computed SHA-256 validation detects exact workspace duplicates and
  pauses them for explicit confirmation.
- Normalized extraction elements retain deterministic line/page locators and
  extraction metadata; empty or invalid input becomes `failed_terminal`.
- Original content remains in quarantine until a future storage adapter and
  malware-scanning decision are approved.

## Acceptance evidence

- TypeScript quarantine-storage tests cover read/head behavior and traversal
  rejection.
- Python extraction tests cover normalization, locators, PDF/TXT support, and
  safe failure codes.
- PostgreSQL integration covers workspace-scoped session creation, finalization,
  extraction completion, and exact duplicate confirmation.

## Explicit follow-up

Before non-local ingestion, select the private S3-compatible storage and
malware scanner required by the roadmap. The local adapter is not a production
provider and must not be enabled for deployed private data.
