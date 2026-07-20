# Cumulore Quest release checklist

This checklist applies only to the temporary Build Week Quest branch. It does
not approve or alter the production Cumulore roadmap.

## Completed deterministic evidence

- [x] Credential-free deterministic fixture build and evaluation.
- [x] Source, provenance, difficulty, combat, and safe-failure unit checks.
- [x] Production web build, documentation-link check, secret scan, and
      whitespace diff check.
- [x] The visible UI labels the built-in experience as **Deterministic Demo**.

## Required before any public Live AI enablement

- [ ] A dedicated OpenAI project has only the intended prepaid balance,
      auto-recharge disabled, and verified usage alerts. Because billing cutoff
      can lag, this is paired with the deployment access boundary below.
- [ ] Deployment-side request and token rate limits are evidenced, or the
      experience is restricted to judges.
- [ ] Controlled live evaluation completes all three sources at all three
      difficulties and records safe aggregate results only.
- [ ] Forty-five questions receive the required manual evidence, distractor,
      clarity, and difficulty review.
- [ ] Provider tests cover refusal, timeout, 429, 5xx, valid repair, failed
      repair, and response redaction.
- [ ] The final recorded demo questions are manually checked and the deployed
      fixture fallback smoke test passes.

Until every unchecked item is evidenced, deployment remains fixture-first and
`QUEST_LIVE_GENERATION_ENABLED` stays `false`.
