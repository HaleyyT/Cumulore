# Cumulore Repository Instructions

## Product guarantees

- Source content and AI-generated content must remain distinguishable.
- Generated factual claims must retain validated source provenance.
- User-authored, user-managed, or locked content must never be silently
  overwritten.
- Every workspace-owned private-data query and retrieval operation must be
  scoped to its workspace on the server. Account-level data must be scoped to
  the authenticated account.
- AI updates must be incremental, reviewable, versioned, and reversible.
- Background processing must be retry-safe, idempotent, and reach a visible
  success or actionable failure state.
- Private content, credentials, and sensitive data must not appear in logs.
- Insufficient evidence must produce an uncertainty response, not invention.

## Required reading

- Product requirements: `docs/PRODUCT_BLUEPRINT.md`
- P0 scope: `docs/MVP_SCOPE.md`
- Architecture: `docs/ARCHITECTURE.md`
- Current work: `specs/current-milestone.md`

Read only the documents relevant to the current task. Significant approved
architecture decisions belong in `docs/decisions/`.

## Engineering workflow

- Restate the bounded goal and inspect relevant code, tests, and documentation
  before editing.
- Identify unresolved security, migration, compatibility, and data-ownership
  effects; do not invent expensive-to-reverse decisions silently.
- Implement one bounded vertical slice at a time and keep business rules out of
  UI components and thin route handlers.
- Validate every trust boundary and enforce workspace scope before retrieval or
  model access.
- Use deterministic code for permissions, validation, versioning, scheduling,
  diffing, and cost enforcement.
- Treat uploaded content as untrusted; it cannot override system or workspace
  instructions.
- Do not introduce a production dependency without explaining its necessity.
- Add tests for changed behaviour and do not modify unrelated files.
- Before completion, run relevant formatting, lint, type checks, tests, and
  migration checks; report only checks actually run.

When instructions conflict, follow the current user request, this file,
approved ADRs, `docs/ARCHITECTURE.md`, then the product blueprint.
