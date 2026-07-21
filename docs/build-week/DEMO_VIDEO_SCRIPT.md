# Cumulore Quest demo video script

Target runtime: **2 minutes 25 seconds**. Hard limit: **under 3 minutes**.
Voiceover is required and must cover the product, Codex, and GPT-5.6.

The script may be read by the builder or an AI voice. Rehearse it once and
replace any phrase that does not sound natural. Do not show loading, typing,
secrets, dashboards, or private material; use tight cuts and clear captions.

## Before recording

- Use a synthetic, public-domain, or self-authored source.
- Select the exact quest and manually verify every question, answer,
  explanation, and excerpt that will appear.
- Record at 1080p, browser zoom 100%, notifications off, and a clean window.
- Use **Medium Deterministic Demo** for the continuous walkthrough. Its complete
  16-question bank is the reviewed recording source. Do not switch difficulty
  or content after that review. Optionally insert one
  clearly labelled controlled Live AI generation clip after it has been reviewed.
- Keep the cursor slow, pause after important changes, and do not narrate while
  visually rushing to another screen.
- Record clean voice separately if room audio is distracting. Background music
  must remain well below the narration.

## Shot-by-shot script

### 0:00–0:12 — hook

**Screen:** Product title, then the setup view.

**Voiceover:**

> Studying often fails before the first question: turning a pile of notes into
> useful practice takes too much effort. I built Cumulore Quest to turn source
> material into a grounded learning game in one short flow.

### 0:12–0:30 — learner control and transparent mode

**Screen:** Show source title, material, learning goal, difficulty, consent, and
the clearly labelled Deterministic Demo or Live AI mode. Do not type in real
time; use a prepared source.

**Voiceover:**

> A learner provides material, chooses one difficulty for the whole quest, and
> can name a learning goal. The interface clearly distinguishes the reliable
> fixture demo from Live AI and explains when material is sent to OpenAI.

### 0:30–0:46 — priority focus

**Screen:** Start the quest and show the five ranked Priority Focus concepts.

**Voiceover:**

> The result starts with five ranked concepts, then moves through foundation,
> connection, and synthesis. That progression changes the kind of thinking, not
> the difficulty the learner selected.

### 0:46–1:16 — play and evidence

**Screen:** Answer one question correctly, then show feedback and its source
excerpt. Show one incorrect answer if it can be done without slowing the edit.

**Voiceover:**

> Each answer changes the battle, but the model never controls combat. Typed
> application code owns health, damage, hearts, scoring, progression, and
> rematches. Feedback teaches why an answer is right or wrong and points back to
> a validated excerpt instead of asking the learner to trust an unsupported
> explanation.

### 1:16–1:34 — results and deliberate practice

**Screen:** Use a prepared cut to stage victory, results, and targeted rematch.

**Voiceover:**

> Three consecutive correct answers can win a stage within its four main
> questions. Missed concepts feed a prepared rematch, so the game ends with
> focused practice rather than just a score.

### 1:34–1:58 — technical credibility

**Screen:** Brief split or quick cuts of the validated contract, focused test
output, and the running app. Keep code large enough to read.

Use the three prepared recording panels in
[`TECHNICAL_PROOF_SHOTS.md`](TECHNICAL_PROOF_SHOTS.md); they contain verified,
secret-free excerpts and the exact focused test output.

**Voiceover:**

> Live generation uses GPT-5.6 Terra through the Responses API with strict
> Structured Outputs, store false, bounded retries, and server-only credentials.
> Deterministic validators reject broken source locators, excerpts, options,
> duplicates, identifiers, and difficulty rules before generated content can
> reach the game. The fixture uses the same contract, so judges always have a
> credential-free path.

### 1:58–2:22 — Codex and GPT-5.6 build story

**Screen:** Show the commit history, one focused test file, and the accepted
Build Week plan. Never show the Session ID or private conversation text.

Use the four prepared, judge-safe recording panels in
[`CODEX_BUILD_STORY_SHOTS.md`](CODEX_BUILD_STORY_SHOTS.md). They map exact
spoken phrases to real commits, plan decisions, passing checks, and the human
acceptance boundary.

**Voiceover:**

> I used Codex throughout the build—not only for code generation. GPT-5.6 helped
> me challenge the contract, separate educational generation from game rules,
> plan reviewable slices, implement and test the boundaries, and diagnose live
> deployment failures. I made the product and scope decisions, reviewed the
> code, and required each slice to pass its checks before accepting it.

Replace the preceding sentence with one specific example from the primary
Codex session if possible. Specificity is stronger than a list of tools.

### 2:22–2:35 — close

**Screen:** Return to the finished results or Priority Focus view with the
product name visible.

**Voiceover:**

> Cumulore Quest removes the setup friction between having material and actually
> practising it—while keeping evidence visible and the rules dependable. That is
> how I want learning with AI to feel: active, playful, and trustworthy.

## Editing and upload acceptance gate

- Final duration is below 2:55; target remains 2:25–2:40.
- Spoken audio is intelligible on a phone speaker and covers Codex and GPT-5.6
  explicitly.
- No API key, environment value, OpenAI/Vercel billing page, personal browser
  tab, private source, Session ID, or raw provider payload is visible.
- Captions match the narration and use large high-contrast text.
- All loading and typing pauses are removed; speed-up is labelled if it could
  otherwise misrepresent generation latency.
- YouTube visibility is Public or Unlisted, processing has completed, and the
  link plays from start to finish in an incognito window.
- The URL is saved in Devpost well before the deadline.
