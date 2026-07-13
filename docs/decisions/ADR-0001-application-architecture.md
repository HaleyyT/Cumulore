# ADR-0001: Application Architecture

- **Status:** Accepted
- **Date:** 2026-07-13
- **Accepted:** 2026-07-13
- **Decision owners:** Product and engineering

## Context

Cumulore needs a production-minded private alpha that a small team can operate.
The web product and deterministic business rules fit a TypeScript application,
while document extraction and model tooling are stronger in Python. Splitting
each domain into a service would add deployment and consistency costs before
there is evidence that independent scaling is needed.

## Decision

Use a monorepo containing:

1. One Next.js App Router application as the public web application and modular
   product backend.
2. One Python worker deployment for extraction, indexing, generation, and AI
   evaluation jobs.
3. One PostgreSQL database as the transactional source of truth, initial durable
   job queue, full-text index, and vector store through pgvector.
4. S3-compatible private object storage for originals and large derived files.
5. Versioned JSON Schema contracts shared across TypeScript and Python.

The web and worker are separate processes, not separately owned microservices.
They share a release train and database migrations, but use different database
roles and table grants. The worker may write extracted data, job state, and
generated proposals; only the web application can publish artifact versions or
change user-owned content.

Deploy the web and worker as separate deployment units using immutable
application builds or container artifacts, according to the selected hosting
provider. Use managed PostgreSQL and object storage. Do not add Redis, a
dedicated message broker, a standalone vector database, Kubernetes, or internal
HTTP APIs until a measured requirement justifies them.

## Consequences

- The small team has one repository, one migration history, and two runtime
  processes.
- PostgreSQL job claiming and retention must be monitored; queue extraction is
  the planned escape hatch if workload affects transactional latency.
- Cross-language contracts require schema fixtures and compatibility checks in
  CI.
- Direct database access by two runtimes requires explicit table ownership,
  least-privilege roles, row-level security, and transaction-scoped tenant
  context.
- Provider-specific services stay behind authentication, object-storage, model,
  and telemetry adapters.

## Reconsider when

- Worker load measurably harms transactional database latency.
- A workload needs independent availability, security isolation, or release
  cadence.
- PostgreSQL retrieval cannot meet measured corpus size, latency, or recall
  targets.
- Regional or institutional isolation creates a concrete deployment need.
