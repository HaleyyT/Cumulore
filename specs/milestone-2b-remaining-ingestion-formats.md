# Milestone 2B — Remaining Ingestion Formats

**Status:** Implemented and awaiting review

**Implemented:** 2026-07-15

Milestone 2B extends the accepted PDF/TXT/pasted-text ingestion contract to
DOCX and PPTX. It uses Python's standard library ZIP/XML readers so no parser
provider or production dependency is introduced before parser isolation and
malware decisions are approved.

## Guarantees

- DOCX paragraphs, headings, and tables become normalized elements with stable
  paragraph/table locators.
- PPTX slide text becomes normalized page elements with stable slide locators.
- ZIP expansion is bounded by the existing upload limit and malformed archives
  produce safe actionable errors.
- Existing workspace scope, exact hash duplicate detection, quarantine state,
  idempotent source-version writes, and operational-log redaction remain
  unchanged.

## Explicit boundary

The readers intentionally support deterministic unencrypted Office Open XML
documents. Encrypted, malformed, oversized, or structurally unsupported files
fail visibly; they are never converted into empty success. Production storage,
malware scanning, parser sandboxing, and upload routes remain deployment gates.

## Acceptance evidence

- Unit tests cover DOCX headings/paragraphs/tables, PPTX slide ordering and
  locators, archive limits, and safe failures.
- TypeScript validation accepts only the approved DOCX/PPTX MIME pairings.
- The isolated PostgreSQL/pgvector suite reruns all prior ingestion, security,
  operational, and worker checks from clean and upgrade schemas.
