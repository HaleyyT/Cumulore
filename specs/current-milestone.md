# Current Milestone: Architecture Readiness Review

**Status:** Active, planning only

**Last updated:** 2026-07-13

## Goal

Make the P0 architecture documentation internally consistent and detailed
enough to begin Milestone 1A only after final architecture-readiness approval.

## In scope

- Correct account-level and workspace-owned tenancy terminology.
- Standardize unversioned event types with numeric schema versions.
- Separate artifact mutation ownership from AI-processing inclusion.
- Use provider-neutral immutable build/deployment wording.
- Define the PDF and TXT/pasted-text first ingestion slice, followed by DOCX and
  PPTX through the same extraction interface.
- Split the foundation into Milestones 1A, 1B, and 1C with provider gates at the
  first milestone that needs them.
- Record ADR-0001 as accepted and draft ADR-0002 and ADR-0003 as proposed.
- Complete a documentation link, terminology, whitespace, and scope review.

## Out of scope

- Application or worker scaffolding.
- Dependency manifests or dependency installation.
- Database migrations, generated files, schemas, or runtime contracts.
- Runtime code, infrastructure provisioning, or provider configuration.
- Commits.

## Readiness gates

- ADR-0002 must be reviewed and accepted before Milestone 1B implementation.
- ADR-0003 must be reviewed and accepted before Milestone 1C implementation.
- OIDC selection is deferred to Milestone 1B.
- Object-storage, malware-scanner, and upload-limit selections are deferred to
  Milestone 2A.
- Embedding and model providers are deferred to Milestone 3.
- Production hosting, region, telemetry backend, retention, and recovery policy
  are deferred until Milestone 6 before staging.

## Completion criteria

- `AGENTS.md`, `docs/MVP_SCOPE.md`, `docs/ARCHITECTURE.md`,
  `docs/ROADMAP.md`, this specification, and `docs/decisions/` use consistent
  terminology and gates.
- Event examples contain no schema-version suffix in `event_type`.
- Planned documents that do not yet exist are labelled rather than linked as
  current sources.
- Documentation checks and `git diff --check` pass.
- The complete diff contains documentation and repository-guidance files only.
- The user gives final architecture-readiness approval.

Until the final approval is given, the architecture remains proposed for
implementation readiness and Milestone 1A must not begin.
