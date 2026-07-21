# Cumulore Quest judge handoff

This page is the concise testing map for the temporary Build Week branch.

## What to evaluate

Cumulore Quest is an Education app that converts study material into a
source-grounded three-stage learning game. The central boundary is **content
teaches; code plays**: generated content can supply educational concepts,
questions, explanations, and cited excerpts, while deterministic application
code owns every game mechanic.

## Fastest reliable path

1. Open the deployed URL only if it was supplied and is accessible without the
   owner's Vercel account.
2. Select **Deterministic Demo**. It requires no provider key or paid call.
3. Choose a difficulty and start the quest.
4. Review the five Priority Focus concepts.
5. Answer a question and inspect the explanation and source evidence.
6. Complete or skip ahead through edited demo cuts to inspect results and the
   targeted rematch.

The optional Live AI path sends acknowledged material to OpenAI and uses the
same contract. It may be closed outside a controlled judge window to enforce the
prepaid cost boundary. Its availability is not required for the deterministic
judge path.

## Repository

- Submitted repository branch:
  `https://github.com/HaleyyT/Cumulore/tree/hackathon/openai-build-week-cumulore-quest`
  (private; judge access must be granted before the deadline)
- Build Week branch: `hackathon/openai-build-week-cumulore-quest`; do not judge
  the default `main` branch as the hackathon submission.
- Quest app: `apps/web/src/modules/quest/`
- Generation route: `apps/web/src/app/api/quest/generate/route.ts`
- Focused tests: `apps/web/tests/quest-*.test.ts` and
  `apps/web/tests/live-quest.test.ts`
- Accepted plan and release evidence: `docs/build-week/`

## Local setup

Prerequisites are Node.js 22, Corepack/pnpm from `packageManager`, and the
repository's locked dependencies.

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm --filter @cumulore/web exec next dev
```

Open `http://localhost:3000` and use Deterministic Demo. No API key, Auth0
tenant, PostgreSQL, MinIO, or external provider is required for this path.

## Focused verification

```bash
pnpm quest:eval -- --provider=fixture
pnpm --filter @cumulore/web test:quest
pnpm build:production
pnpm docs:check
pnpm secrets:check
```

The broader monorepo contains the separately planned production Cumulore
foundation. The Build Week judging surface is the Quest branch and paths above;
the hackathon work does not claim that later production milestones are complete.

## Safety and limitations

- Fixture mode is the default and requires no credentials.
- Live material is not persisted by this hackathon application, but OpenAI may
  process or retain it under applicable policies; the UI discloses the transfer.
- Responses API requests use `store: false`.
- Model content is rejected unless it matches the strict schema and source,
  provenance, uniqueness, option, identifier, and difficulty rules.
- The source input is plain text in this hackathon build. Production document
  ingestion, accounts, long-term progress, and broader formats are not claimed.
- The live public endpoint is not intended to be unrestricted. A protected judge
  deployment or fixture-first public experience preserves the fixed cost limit.
- Credentials, private material, signed URLs, and raw provider payloads must not
  appear in logs, documentation, video, or error responses.

## Judge-access acceptance gate

Before pasting a deployed URL into Devpost, open it in a fresh incognito window
with no Vercel session. If it requests owner authentication, omit the optional
URL or provide an explicitly authorised judge access method in Devpost's private
instructions. Never paste an API key or reusable platform credential into the
submission.
