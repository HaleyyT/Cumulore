# OpenAI Build Week submission readiness

Last verified: 22 July 2026, Sydney time.

## Current verdict

**Registered and draft started; not yet ready to submit.** Eight of eleven
submission evidence gates are confirmed. The remaining critical path is the
`/feedback` Session ID, the demo video, and changing the Devpost project from
Draft to Submitted.

The Devpost screenshot confirms the submission exists and the Manage team step
is complete. The official integration confirms the account is registered and
submissions remain open. The draft may remain absent from API project listings
while it is untitled or has not been saved from Project overview.

## Evidence-backed checklist

| Gate                                   | Status                | Evidence or exact next action                                                                                                                                         |
| -------------------------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Registered for OpenAI Build Week       | Confirmed             | Devpost registration and the visible submission draft.                                                                                                                |
| Submission draft started               | Confirmed             | Devpost shows `Untitled`, `DRAFT`, and `1/5 steps done`. Save Project overview promptly so it is indexed.                                                             |
| Team step complete                     | Confirmed with caveat | Devpost marks Manage team complete. If this is not a solo entry, verify every invite shows Accepted before the deadline.                                              |
| Core project works                     | Confirmed             | Credential-free quest, protected live path, focused Quest tests, fixture evaluation, production build, and full repository verification passed on 22 July 2026.       |
| Remote repository and branch exist     | Confirmed             | Public repository `HaleyyT/Cumulore`; branch `hackathon/openai-build-week-cumulore-quest` matches its remote.                                                         |
| README setup and Codex/GPT-5.6 story   | Confirmed             | README contains setup, run commands, architecture boundaries, copyright, and a dedicated Codex/GPT-5.6 section.                                                       |
| Judge repository access and licensing  | Confirmed             | GitHub visibly reports the repository as Public. The direct submitted-branch URL is documented, and `LICENSE` grants narrow Build Week evaluation rights.             |
| Primary `/feedback` Session ID entered | **Blocked**           | In the official Codex task where most core work happened, run `/feedback`; copy the returned alphanumeric ID directly to Additional info. Do not invent or commit it. |
| Final demo questions reviewed          | Confirmed             | All 16 Medium deterministic questions, answers, explanations, distractors, and excerpts passed manual review; the recording is locked to that bank.                   |
| Demo video accepted by YouTube         | **Blocked**           | Record from `DEMO_VIDEO_SCRIPT.md`, keep it under three minutes, upload Public or Unlisted, and test the URL in a signed-out/incognito window.                        |
| Submission marked Submitted            | **Blocked**           | Complete all five Devpost steps, submit, then return to My projects and verify a green `Submitted` label—not Draft.                                                   |

## Do these now, in order

1. Save Project overview with the user-chosen name **Cumulore Quest**, the
   elevator pitch from the worksheet, and a thumbnail.
2. Run `/feedback` in the primary Codex build task and paste the Session ID into
   Devpost Additional info.
3. Fill the remaining Devpost fields from the worksheet, but rewrite the
   personal motivation and reflection in your own voice.
4. Record the locked Medium Deterministic Demo path. If its content or
   difficulty changes, repeat the complete visible-question review first.
5. Record and upload the video. Do not show secrets, dashboards, private source
   material, browser notifications, or provider responses.
6. Test the YouTube link and any optional deployed URL in an incognito window.
7. Commit and push this submission documentation and README update.
8. Submit by 7:00 am Sydney time if possible, then verify the green Submitted
   status. Use the remaining time only for safe corrections.

## Judging evidence map

| Criterion                    | Evidence to show rather than merely claim                                                                                                                                                                                                                       |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Technological Implementation | The strict versioned quest contract; provider output excluded from game mechanics; server-only Responses API; `store: false`; deterministic provenance and difficulty validation; fixture/live parity; adversarial tests and safe failure handling.             |
| Design                       | One coherent setup-to-focus-to-battle-to-review journey; clear fixture/live disclosure; keyboard and reduced-motion support; answer evidence; recoverable errors; rematch path.                                                                                 |
| Potential Impact             | A learner converts material they already need to study into active recall, receives explanations tied to the material, and practices weaknesses without manually authoring a quiz. Demonstrate the reduced setup friction.                                      |
| Quality of the Idea          | Misconceptions become stage enemies while educational content remains source-grounded and the application retains deterministic control of play. It combines practice, feedback, evidence, and game progression without letting the model manipulate the rules. |

## Release safety

- Use synthetic or public-domain study material in the video.
- Prefer Deterministic Demo for the uninterrupted judge journey. A controlled
  live-generation clip may be included only after its visible content is
  reviewed.
- Do not expose an unrestricted paid generation endpoint. The current $5
  prepaid balance and disabled auto-recharge limit billing, but they do not
  replace access and request controls.
- Do not put API keys, session IDs, judge credentials, signed URLs, source
  submissions, raw model output, or private review notes in Git.
- If the optional deployed URL cannot be opened in an incognito window without
  owner-only Vercel authentication, omit it from the judge URL field. The field
  is optional; a broken link is worse than a clear video and runnable repo.
