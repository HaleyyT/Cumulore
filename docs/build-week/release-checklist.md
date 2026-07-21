# Cumulore Quest release checklist

This checklist applies only to the temporary Build Week Quest branch. It does
not approve or alter the production Cumulore roadmap.

## Completed deterministic evidence

- [x] Credential-free deterministic fixture build and evaluation.
- [x] Source, provenance, difficulty, combat, and safe-failure unit checks.
- [x] Production web build, documentation-link check, secret scan, and
      whitespace diff check.
- [x] The visible UI labels the built-in experience as the **Ready-made quest**
      and distinguishes it from Live AI.

## Controlled production smoke — 22 July 2026

- [x] Vercel production deployment `2a48f14` reached `READY` and was aliased to
      `https://cumulore.vercel.app`.
- [x] The deployed page reported Live AI as ready and kept the expanded setup
      stable while entering a synthetic source.
- [x] One Medium live request returned a validated quest titled _How Durable
      Learning Works_ with five ranked Priority Focus concepts.
- [x] The persistent **Live AI quest ready** notice appeared, its action moved
      focus to the generated chamber, and manual scrolling remained available.
- [x] A generated answer updated deterministic combat state and displayed a
      matching source excerpt.

This is a bounded production smoke test, not the required nine-case automated
evaluation or 45-question manual review.

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
