# Current Milestone: Milestone 1C — Durable Processing Foundation

**Status:** Approved for implementation

**Approved:** 2026-07-14

## Goal

Prove retry-safe durable processing with synthetic work before private source
files or product automation are introduced.

## In scope

- Transactional outbox events, versioned contracts, bounded dispatch, jobs,
  leases, attempts, retries, cooperative cancellation, and dead letters.
- Endpoint and handler-effect idempotency.
- A deterministic synthetic worker and fake external provider, real PostgreSQL
  RLS integration tests, retention cleanup, and operational metrics.

## Out of scope

- Milestone 2A and all ingestion, uploads, extraction, storage-provider,
  retrieval, model, note-generation, artifact, and product UI work.
- Any real model, external processing, or production-hosting provider.

## Readiness gate

ADR-0003 is accepted. `action-required` remains a product-visible outcome
backed by dead-letter or unresolved-operation state, not a job state.
