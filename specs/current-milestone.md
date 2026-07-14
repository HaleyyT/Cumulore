# Current Milestone: Milestone 2B — Remaining Ingestion Formats

**Status:** Implemented and awaiting review

**Approved:** 2026-07-15

## Goal

Extend the accepted ingestion foundation to DOCX and PPTX while preserving the
same workspace scope, quarantine, duplicate, extraction, locator, quality,
failure, and idempotency contracts.

## Reviewable slices

1. **DOCX:** deterministic paragraphs, headings, tables, and paragraph/table
   locators using the existing normalized extraction contract.
2. **PPTX:** deterministic slide text with stable slide locators using the same
   normalized extraction contract.
3. **Safety:** bounded ZIP expansion, malformed/archive failure codes, exact
   duplicate hashing, and no source content in operational logs.

## Explicit exclusions

- No production S3 adapter, malware provider, upload route, product UI, model,
  embedding, retrieval, or other Milestone 3+ functionality.
- No OpenTelemetry SDK/backend, Redis, broker, Kafka, AWS service, Spring Boot,
  ORM, or logging framework.

## Exit gate

- `pnpm verify` and `pnpm test:integration:isolated` pass from a clean install.
- DOCX/PPTX reach `succeeded` or an actionable terminal failure without
  duplicate downstream elements.
- Existing 2A-H operational evidence remains green and is rerun after the
  format expansion.
