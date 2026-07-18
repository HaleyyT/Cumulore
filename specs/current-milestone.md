# Current Milestone: Reliability Remediation — P0 Feature Freeze

**Status:** Reliability corrections implemented through deterministic external
reconciliation and bounded retrieval hardening; review required

**Scope:** P0 dependency, tenancy, durable-retention, worker, provenance,
grounding, migration-safety, and retrieval-boundary corrections

The previously implemented Milestone 3 work remains implemented and awaiting
review. This transition does not accept Milestone 1C.5, Milestone 2B, or
Milestone 3, and it does not authorize any later product milestone.

## Reliability remediation exit gate

- The private reliability plan and audit evidence remain ignored by Git.
- Dependency, build, Python reproducibility, CI, fresh/upgrade migration,
  tenancy, retention, worker-smoke, fake external reconciliation, provenance,
  grounding, and bounded-retrieval checks pass.
- No critical or high production dependency advisories remain.
- No real provider, product UI, upload route, or publication write path is
  enabled.
- The complete remediation diff is explicitly reviewed before any commit or
  publication.

## Previously implemented milestone — awaiting review

The following Milestone 3 scope is preserved as historical implementation
context. It is not accepted by this milestone transition.

## Goal

Add structure-aware chunks, folder-scoped PostgreSQL retrieval, versioned
hybrid ranking, provenance fields, and explicit insufficient-evidence behavior
without selecting a production external embedding or model provider.

## Reviewable slices

1. **Chunking:** structure-aware, heading-aware chunks with stable checksums,
   locators, and bounded token metadata.
2. **Scope:** immutable direct/descendant folder snapshots materialized before
   retrieval.
3. **Retrieval:** indexed PostgreSQL full-text search with authorized result
   provenance and an insufficient-evidence response.
4. **Hybrid and citations:** versioned vector records, deterministic test
   embeddings, hybrid ranking, and exact chunk/locator citation validation.
5. **Reranking:** deterministic heading, token-coverage, and phrase-aware
   reranking over only the already authorized candidate set.
6. **Answer boundary:** a grounded-answer envelope that carries claims and
   citations, and converts insufficient or rejected evidence into visible safe
   statuses without invoking or publishing through a model provider.
7. **Claim support:** deterministic lexical support scoring over the cited
   authorized chunks, with conservative insufficient-evidence handling.
8. **Review proposal:** a versioned, content-hashed answer proposal envelope
   that records the retrieval snapshot and source versions, while remaining
   review-only and unable to publish over user content.
9. **Review decision:** an immutable approval/rejection decision contract that
   preserves proposal version and content hash; it cannot publish content.
10. **Publication gate:** deterministic eligibility checks require a grounded
    proposal and a matching approval before any future ownership-aware write.
11. **Evaluation report:** deterministic, content-redacted quality metrics for
    grounded answers, with non-grounded answers explicitly not evaluable.
12. **Publication readiness:** approval and evaluation gates are combined into
    a deterministic readiness result without performing a write.
13. **Publication intent:** an immutable, hashed optimistic-concurrency
    command records the expected artifact version before any future write.
14. **Intent resolution:** deterministic version-fence resolution returns a
    ready-to-apply result or an explicit conflict without opening a write path.
15. **Publication command:** a matching ready intent produces a deterministic,
    idempotency-keyed command without performing the artifact write.
16. **Publication outcome:** redacted applied, duplicate, conflict, and safe
    failure outcomes preserve command identity without logging content.

## Explicit exclusions

- No production S3 adapter, malware provider, upload route, product UI, model,
  embedding provider, or question-answer generation provider.
- No OpenTelemetry SDK/backend, Redis, broker, Kafka, AWS service, Spring Boot,
  ORM, or logging framework.

## Exit gate

- `pnpm verify` and `pnpm test:integration:isolated` pass from a clean install.
- Retrieval returns only chunks inside a materialized authorized scope.
- No-match queries return explicit insufficient evidence.
- Existing 2A-H and 2B evidence remains green and is rerun after retrieval
  changes.
