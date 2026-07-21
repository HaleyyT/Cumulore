# Cumulore Quest — technical proof shots

Use this document only as a clean recording surface for the **1:34–1:58
technical credibility** section of the demo video. Open the Markdown preview,
hide the editor sidebar, zoom until the text is comfortably readable, and
record the three panels below as separate 4–6 second shots.

Do not show environment files, API keys, terminal history, private browser
tabs, or raw provider responses.

## Exact voiceover cue sheet

The technical voiceover contains three sentences. Make one clean cut at each
sentence boundary; do not crossfade technical screenshots because it makes
small text harder to read.

| Approx. time | Show                                       | Start when the voice says                 | Keep visible through            |
| ------------ | ------------------------------------------ | ----------------------------------------- | ------------------------------- |
| 1:34–1:43    | **Shot 1 — constrained OpenAI generation** | “**Live generation** uses GPT-5.6 Terra…” | “…**server-only credentials**.” |
| 1:43–1:53    | **Shot 2 — deterministic evidence gate**   | “**Deterministic validators** reject…”    | “…can **reach the game**.”      |
| 1:53–1:58    | **Shot 3 — focused proof output**          | “**The fixture** uses the same contract…” | “…a **credential-free path**.”  |

If the recorded narration is slightly faster or slower, align cuts to these
spoken phrases rather than forcing the approximate timestamps.

### What should be visible in each screenshot

- **Shot 1:** Capture the `OPENAI GENERATION BOUNDARY` block only. It is the
  clearest match for the first sentence. If there is time for one extra
  two-second cut, switch to the implementation excerpt exactly when the voice
  reaches “**strict Structured Outputs**,” then hold it through
  “**server-only credentials**.”
- **Shot 2:** Capture the `GENERATED QUEST ACCEPTANCE GATE` block, including
  both `FAIL` lines. Start with its heading already visible before the word
  “**Deterministic**”; do not scroll down to the typed failure-code list during
  this sentence.
- **Shot 3:** Capture only the four-line `Verified output` block. Keep the test
  commands out of the crop; the passing results are faster for judges to
  understand. At the end of “**credential-free path**,” cut directly back to
  the running ready-made quest.

## Shot 1 — constrained OpenAI generation

**On-screen caption:** `Structured generation · private server boundary`

```text
OPENAI GENERATION BOUNDARY

Model                 GPT-5.6 Terra
API                   Responses API
Output                strict JSON Schema
Provider storage      store: false
SDK retries           disabled (maxRetries: 0)
Request timeout       bounded by server configuration
Repair                at most one validated repair attempt
Credentials           server-only
```

Implementation evidence:

```ts
new OpenAI({
  apiKey: config.apiKey,
  maxRetries: 0,
  timeout: config.timeoutMs,
});

{
  model: config.model,
  store: false,
  text: {
    format: {
      type: "json_schema",
      name: "quest_generation_v1",
      strict: true,
      schema: openAIQuestSchema,
    },
  },
}
```

Source:
`apps/web/src/modules/quest/generation/openai-provider.ts`

## Shot 2 — deterministic evidence gate

**On-screen caption:** `Generated content cannot bypass deterministic checks`

```text
GENERATED QUEST ACCEPTANCE GATE

✓ JSON Schema and version
✓ Requested difficulty and stage cognition
✓ Known source-segment locators
✓ Verbatim source excerpts
✓ Exactly one valid answer among four unique options
✓ Valid concept references
✓ Globally unique identifiers
✓ Non-duplicated question prompts

FAIL → one constrained repair attempt
FAIL AGAIN → quest is rejected before play
```

The validator returns safe, typed failure codes:

```ts
SCHEMA_INVALID;
LOCATOR_UNKNOWN;
EXCERPT_MISMATCH;
OPTION_INVALID;
REFERENCE_INVALID;
IDENTIFIER_DUPLICATE;
CONTENT_DUPLICATE;
DIFFICULTY_RULE_MISMATCH;
```

Sources:

- `apps/web/src/modules/quest/validation.ts`
- `apps/web/src/modules/quest/generation/quest-service.ts`
- `packages/schemas/contracts/quest-generation.v1.schema.json`

## Shot 3 — focused proof output

**On-screen caption:** `The contract and fallback are tested, not assumed`

Run these commands immediately before recording:

```bash
pnpm --filter @cumulore/web exec tsx tests/quest-openai-request.test.ts
pnpm --filter @cumulore/web exec tsx tests/quest-provenance.test.ts
pnpm --filter @cumulore/web exec tsx tests/quest-service.test.ts
pnpm --filter @cumulore/web exec tsx tests/quest-generation.test.ts
```

Verified output:

```text
Quest OpenAI request configuration passed.
Quest provenance and difficulty validation passed.
Quest service validation boundary passed.
Deterministic quest fixture passed.
```

The ready-made quest uses deterministic application-owned content and the same
runtime game boundary, so judges retain a credential-free path when live AI is
unavailable.

## Recommended edit

1. Show **Shot 1** from “Live generation” through “server-only credentials.”
2. Cut to **Shot 2** from “Deterministic validators” through “reach the game.”
3. Cut to **Shot 3** from “The fixture” through “credential-free path,” then
   return immediately to the running ready-made quest.

Keep each panel still long enough to read. Do not scroll within a shot; use a
clean cut between panels.
