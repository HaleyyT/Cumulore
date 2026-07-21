# Vercel Live AI runbook

This runbook applies only to Cumulore Quest on the isolated Build Week branch.
It does not change the production Cumulore milestone or authorize unrestricted
public model usage.

## Why a key alone does not enable Live AI

Live generation fails closed unless all three server-side variables are set:

```text
QUEST_PROVIDER=openai
QUEST_LIVE_GENERATION_ENABLED=true
OPENAI_API_KEY=<real secret from a dedicated OpenAI project>
```

The two explicit flags prevent an accidentally configured credential from
turning on a paid public endpoint. A value such as
`your_actual_OpenAI_API_key` is only example text and is rejected.

## Safe Vercel configuration

1. Use a dedicated OpenAI project for this demo. Purchase only the intended
   prepaid balance, turn auto-recharge off, and configure usage alerts. OpenAI
   project budgets are alert thresholds rather than hard caps, and prepaid
   cutoff can be delayed, so billing settings do not replace deployment access
   control.
2. In Vercel Project Settings, add the three variables above to the exact
   environment being tested: Preview, Production, or both. Mark the API key as
   sensitive and never expose it with a `NEXT_PUBLIC_` prefix.
3. Keep the optional defaults unless a controlled evaluation justifies a
   change:

   ```text
   OPENAI_QUEST_MODEL=gpt-5.6-terra
   OPENAI_QUEST_REASONING_EFFORT=low
   OPENAI_QUEST_TIMEOUT_MS=60000
   QUEST_SOURCE_MAX_CHARS=10000
   QUEST_OUTPUT_MAX_TOKENS=10000
   ```

4. Protect the deployment for judges or configure enforceable platform request
   limits. Repeated-click protection in the browser does not replace a
   server-side cost boundary.
5. Redeploy after changing environment variables. Existing deployments do not
   receive newly added values automatically.

The default uses Terra because it retains the Responses API and strict
Structured Outputs while costing half as much per token as Sol at the time of
this review. Sol remains an allowed, explicit override for controlled quality
comparisons; it is not the cost-safe default. Recheck the official model
pricing before the final evaluation rather than treating these relative prices
as permanent.

The 10,000-token response ceiling includes visible output and reasoning tokens.
Together with the 10,000-character source limit, zero SDK retries, and at most
one validation repair, it bounds the cost of one submission. It does not bound
the number of submissions, so keep the deployment judge-protected unless a
durable platform-side request quota is configured.

The route permits 150 seconds because an initial generation and its single
repair can each use the 60-second provider-call timeout. Do not reduce the host
deadline below that bounded two-call path: the platform would return a generic
504 before the application can return its safe fallback response.

## Verification

1. Open the redeployed URL in a fresh session. The Live AI section must show a
   **ready** badge rather than **offline**.
2. Submit one non-sensitive, 100–2,000 character source with a precise learner
   goal. Confirm the response produces five ranked concepts, three stages,
   twelve main questions, four rematch questions, and grounded review notes.
3. Check that every displayed excerpt exists verbatim in the submitted source
   and that the selected difficulty applies throughout the quest.
4. Submit one deliberately unsupported source and confirm it fails safely
   rather than inventing facts.
5. Confirm the API key, source text, filenames, and generated content do not
   appear in browser payloads other than the intended request, Vercel logs, or
   error messages.
6. Run the controlled nine-generation evaluation and manual review required by
   [`release-checklist.md`](release-checklist.md). Do not record private source
   content in committed evidence.

If the page still shows **offline**, confirm the variable names, values,
environment scope, and redeployment. Server configuration errors intentionally
appear as unavailable rather than exposing secret or configuration details.

If the page shows **ready** but generation fails, the environment gate has
passed and the message now identifies the safe provider failure category:

| Message category      | Check                                                                                     |
| --------------------- | ----------------------------------------------------------------------------------------- |
| Credential rejected   | Replace `OPENAI_API_KEY` with a valid key from the dedicated API project and redeploy.    |
| Project access denied | Confirm the project and key are permitted to use the configured model.                    |
| Model unavailable     | Remove an incorrect `OPENAI_QUEST_MODEL` override or use the documented default.          |
| Quota exhausted       | Add prepaid API credit deliberately; confirm auto-recharge remains off before retrying.   |
| Request rejected      | Confirm the deployment contains the latest provider-compatible Structured Outputs schema. |

The server records only the request UUID, duration, and safe failure code for
these failures. It never logs the key, submitted source, title, learner goal,
provider response, or generated content.

## Public release boundary

The live route uses strict structured output, `store: false`, bounded source
and output sizes, one sanitized repair attempt, safe errors, and browser-side
duplicate-submit protection. These controls improve correctness but do not
provide distributed rate limiting. Until every unchecked item in
[`release-checklist.md`](release-checklist.md) is evidenced, keep the public
deployment fixture-first or restrict Live AI to judges.
