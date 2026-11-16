# Model report v3: hosted flashcard generation (Groq + OpenRouter)

Status: pending measurement. This report will replace the v2 recommendation
for current generation choices once the hosted campaign has run with real
keys. The prior report remains as the record for the GX10 models, which are
no longer reachable.

Raw generations, judge flags, prompts, and the drivers are stored in
`infra/gx10/results/2026-11-03-hosted/`.

## Methodology

The campaign adapts `docs/model-report-v2.md`'s measurement to hosted
providers:

- 10 topics x 5 runs per candidate: the 6 general and 4 language topics from
  v2, rebuilt in the production prompt shape (TOPIC_GENERATION_V1 /
  TEXT_GENERATION_V1 system prompts with source-text topics using the
  From-the-text phrasing the worker sends).
- Parse rate uses the app's own extraction (stripThinking + bracket-depth
  slice), so format success means the worker would have served the set.
- Latency is wall-clock per request; tokens come from the provider usage
  field.
- `reasoning_effort` follows the gateway's mapping (low for gpt-oss, none
  otherwise). Every gpt-oss candidate is probed twice (low and hard-off
  none) to verify the provider honors `none`; `thinkTag` in each JSONL row is
  the safety-net marker for stray reasoning in output.
- Adjudicated issue rate: one hosted judge (configurable in `config.mjs`,
  defaulting to `deepseek/deepseek-chat` on OpenRouter) reviews every parsed
  card with the v2 language-teacher prompt; source-text topics get the
  source document. Unlike v2 there is no two-stage Opus/Fable escalation, so
  an `error` verdict counts as one issue and the rate is `issues / parsed
cards`.

## Results

To be filled from `infra/gx10/results/2026-11-03-hosted/summary.md` after
`node run.mjs && node audit.mjs && node summarize.mjs`.

| model   | format | cards | general median | language median | tokens/set | cents/set | issues | issue rate |
| ------- | -----: | ----: | -------------: | --------------: | ---------: | --------: | -----: | ---------: |
| pending |        |       |                |                 |            |           |        |            |

## Acceptance checklist (from the epic)

- [ ] Tables covering at least 3 Groq candidates and 2 OpenRouter fallbacks
- [ ] Production `balanced` default recorded and justified from the table
- [ ] `reasoning_effort: 'none'` verified as honored by Groq (probe lines in
      `campaign.log`; `stripThinking` stays as safety net regardless)
- [ ] Report linked from README
- [ ] ADR cost/alias table updated to match measured numbers
- [ ] Production staged with real keys in `/opt/notanothercards/.env`
      (primary + fallback pairs, `AI_DEFAULT_MODEL`,
      `MODERATION_ALLOW_ALL=1` documented as temporary)
- [ ] Redeployed via deploy.yml; `ai_usage` + `ai_generation_jobs` watched
      for 24 h; rollback runbook merged

## How to run

1. Export `GROQ_API_KEY` and `OPENROUTER_API_KEY` in the shell (keys are
   read from the environment and never logged).
2. Edit `CANDIDATES` and the judge entry in `config.mjs` if the model list
   or prices changed; verify prices against the provider pricing pages
   before trusting cents/set.
3. `node run.mjs` (optionally pass candidate ids), then `node audit.mjs`,
   then `node summarize.mjs`. Each stage is resumable; completed candidates
   are skipped.
4. Paste `summary.md` into the table above and update the ADR.

Cost expectation: the measured generation cost is on the order of a few
cents per candidate (~50 sets x ~300-1000 tokens), plus the judge pass over
~1,700 cards.
