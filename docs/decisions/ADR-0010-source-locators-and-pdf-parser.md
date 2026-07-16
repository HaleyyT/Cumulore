# ADR-0010: Versioned Source Locators and PDF Parser Boundary

- **Status:** Proposed
- **Date:** 2026-07-16
- **Decision owners:** Product and engineering

## Context

The initial private-alpha fixture extractor treated each matched PDF text
operator as a page. A page containing multiple text operators could therefore
produce false page numbers, while compressed and common exported PDFs were not
parsed reliably. Chunk construction also retained only the first locator when
merging multiple extraction elements. Both behaviors violate the requirement
that generated factual claims retain validated source provenance.

## Proposed decision

- Parse PDFs with the pinned, maintained `pypdf` boundary and derive locators
  from actual `PdfReader.pages` boundaries.
- Use locator version 1 for newly extracted elements and chunks. A locator
  records its source format and between one and 32 ordered segments. Each
  segment contains a structural kind and index; split elements also contain
  start and end character offsets.
- Preserve every contributing locator segment when elements are merged into a
  chunk. Do not merge different structural kinds or formats.
- Treat legacy locators as migration-readable but not retrieval- or
  citation-eligible. Reprocessing creates version-1 locators.
- Reject malformed, encrypted, empty, or over-limit documents with safe error
  codes. OCR remains out of scope.

The current feature-freeze implementation is the candidate evidence for this
ADR. It must not be used to accept the ingestion milestone until this ADR and
the remaining parser-isolation limits are reviewed.

## Consequences

PDF parsing adds one production Python dependency and must remain isolated
from logs, credentials, and network access. Page and segment fixtures become
part of the provenance test matrix. Locator schema changes require a new
version rather than silently changing version 1.
