# Current Milestone: Milestone 2A — First Ingestion Vertical Slice

**Status:** Implemented and awaiting review

**Approved:** 2026-07-14

## Goal

Process authorized PDF, TXT, and pasted-text content through quarantine,
validation, exact duplicate detection, deterministic extraction, and visible
terminal state without introducing external providers.

## In scope

- Workspace-scoped upload sessions and immutable quarantine keys.
- PDF, TXT, and pasted-text validation, exact duplicate detection, and
  deterministic normalized extraction.
- Visible terminal source states and real PostgreSQL RLS integration tests.

## Out of scope

- DOCX/PPTX ingestion, deployed object storage, malware-provider integration,
  retrieval, model, note-generation, artifact, and product UI work.
- Any real model, external processing, or production-hosting provider.

## Readiness gate

ADR-0003 is accepted. `action-required` remains a product-visible outcome
backed by dead-letter or unresolved-operation state, not a job state.
