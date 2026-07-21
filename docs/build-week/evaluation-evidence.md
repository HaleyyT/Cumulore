# Cumulore Quest evaluation evidence

This ledger records only safe aggregate evaluation facts for the temporary Build
Week demo. Do not add source submissions, provider responses, API keys, timing
exports, usage exports, or reviewer identities here.

## Automated checks

| Provider | Command                                 | Status            | Safe result                                                                                                  |
| -------- | --------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------ |
| Fixture  | `pnpm quest:eval -- --provider=fixture` | Passed 2026-07-19 | Three checked sources and three deterministic difficulties validated.                                        |
| Live     | `pnpm quest:eval -- --provider=live`    | Not run           | Requires `QUEST_PROVIDER=openai`, `QUEST_LIVE_GENERATION_ENABLED=true`, and an uncommitted `OPENAI_API_KEY`. |

The fixture check is the only evaluation command permitted in ordinary CI. The
live command runs a three-source by three-difficulty matrix only in a controlled
environment; record its aggregate `9/9` result here after it passes. A live
failure requires fixing the prompt or validation boundary and rerunning all nine
cases before changing this record.

## Medium deterministic demo review — passed

The complete 16-question Medium deterministic bank was reviewed on 22 July
2026 and is the locked source for the final recording. The review covered all
12 main questions and all four prepared rematch questions. Every item has:

- one unambiguous correct answer and three plausible, distinct distractors;
- a question appropriate to its foundation, connection, synthesis, or rematch
  purpose;
- a specific explanation that teaches the reason rather than merely declaring
  the answer correct;
- an excerpt that directly supports the answer, including compound evidence
  where a question connects multiple learning strategies; and
- unique wording within the quest, with all five Priority Focus concepts used.

The Easy and Hard variants are separately exercised by automated fixture tests,
but the final recording must remain on Medium unless the newly selected bank is
manually reviewed again in full.

## Live manual review protocol — pending

Review exactly five questions from each of the nine live cases, for 45 total:
one foundation question, one connection question, one synthesis question, one
rematch question, and one additional stage question rotated evenly across the
matrix. For every reviewed question, confirm:

- the answer and explanation are supported by its cited source evidence;
- distractors are plausible but unambiguously wrong from that source;
- the explanation teaches rather than restates;
- difficulty and cognitive operation match the selected matrix cell; and
- wording is clear, safe, and not duplicative.

| Review gate                  | Completed | Status                        |
| ---------------------------- | --------: | ----------------------------- |
| Live source-difficulty cases |     0 / 9 | Pending controlled evaluation |
| Manual questions             |    0 / 45 | Pending live results          |
| Final-demo questions         |   16 / 16 | Passed Medium fixture review  |

If any sample fails, correct the prompt or validator and repeat the entire
nine-case automated matrix and 45-question review. Keep raw review notes and
provider material outside the repository.
