# Private Alpha Scope

**Status:** Proposed P0 implementation boundary

**Source of truth:** `docs/PRODUCT_BLUEPRINT.md`

## Outcome

A student can create a private course workspace, organise nested folders,
upload supported course material, receive source-grounded notes, search within
an explicit folder scope, edit and protect blocks, and review proposed updates
without losing their work.

## Included

- Managed user authentication and a private workspace.
- Workspace roles (`owner`, `member`) and nested folders; folder-level ACLs are
  deferred, but folder scope and settings inheritance are included.
- PDF, TXT, pasted-text, DOCX, and PPTX ingestion with validation, quarantine,
  exact duplicate detection, deterministic extraction, and visible states.
- Deliver ingestion vertically: support PDF and TXT/pasted text first, then add
  DOCX and PPTX through the same normalized extraction and quality-report
  interface. All four file formats remain required for the private alpha.
- Structure-aware chunks, PostgreSQL full-text search, pgvector embeddings, and
  page/slide/section locators.
- One versioned Course Companion recipe.
- Source notes and one cumulative living document per course folder.
- Claim-level citations, insufficient-evidence behaviour, and citation
  validation.
- Block editing, ownership, locking, immutable versions, proposed diffs,
  acceptance/rejection, and restoration.
- Block ownership controls whether automation may replace or move content; it
  does not control whether content may be read as AI context. A separate
  `ai_processing_policy` (`included` or `excluded`) controls AI use.
- Folder-scoped search and cited question answering.
- A small set of cited practice-question types.
- Automation activity, bounded retries, manual retry, and actionable failure.
- Markdown and structured JSON export. PDF export may follow after core data
  safety is proven.
- Usage metering and hard processing budgets. Payment collection is not
  required for the private alpha.
- Workspace export, source deletion, workspace deletion, and account deletion.

## Deferred

- Real-time collaboration, folder-level sharing, institution administration,
  URLs, cloud-drive/LMS imports, audio/video, OCR,
  mobile apps, flashcards, spaced repetition, concept graphs, inferred style
  training, autonomous web research, billing, and multi-region deployment.
- Near-duplicate blocking. The alpha may report a similarity warning after
  exact duplicate prevention has proven reliable.
- Automatic modification of existing living-document blocks. The alpha creates
  proposals; users publish changes explicitly.
- OCR is disabled by default and requires a later quality and cost decision.

## Alpha success gates

- No cross-workspace access in automated tests or review.
- 100% protected-block preservation in deterministic tests.
- Supported documents always reach a terminal success or actionable failure.
- Citation validity and groundedness reach the blueprint release targets on the
  fixed evaluation set.
- A complete upload-to-reviewed-update journey works without operator database
  intervention.
- Workspace export and deletion are exercised end to end.
