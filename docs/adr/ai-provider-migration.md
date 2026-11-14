# ADR: AI provider migration — Groq primary, OpenRouter failover

## Status

Accepted

## Context

The AI generation system previously relied on a self-hosted ASUS GX10 box running Ollama + LiteLLM, accessed via a private tailnet (`ai.dustyway.org`). The teammate who owned that box left the project, and the GX10 is no longer a reliable dependency. Production already runs on a NanoGPT emergency fallback.

This ADR records the decision to replace the GX10/LiteLLM dependency with two hosted, OpenAI-compatible providers:

- **Primary:** Groq (`api.groq.com/openai/v1`)
- **Failover:** OpenRouter (`openrouter.ai/api/v1`)

The api already speaks `/chat/completions` generically, so no client contract changes are required — only provider config, model aliases, and failover logic.

## Decision

### Provider strategy

| Role     | Provider   | Endpoint                         | Purpose                                             |
| -------- | ---------- | -------------------------------- | --------------------------------------------------- |
| Primary  | Groq       | `https://api.groq.com/openai/v1` | Generation (cards, word notes, playground stream)   |
| Failover | OpenRouter | `https://openrouter.ai/api/v1`   | Generation when Groq is unavailable or rate-limited |

Both providers are OpenAI-compatible, so the api calls `POST {base}/chat/completions` with the same request shape regardless of provider.

### Failover policy

Failover is triggered **only** on:

- Connection errors
- HTTP 5xx responses
- HTTP 429 (rate-limited)
- Stream failure **before the first delta**

Failover is **not** triggered on:

- Parse errors (`AiParseError`) — the model already answered; queue retries own quality problems
- Stream failures **after** the first delta — deltas already forwarded to the browser cannot be replayed; the existing stream-error UI path applies

Each fallback attempt uses a fresh `AbortSignal` under the caller's remaining deadline. HTTP timeouts are not shared across profiles.

### Model aliases (user-facing contract)

Clients no longer send provider-specific model IDs (e.g. `gemma4`, `qwen3.6`). Instead they send user-facing aliases that the gateway maps to provider model IDs:

| Alias      | Intended use              | Groq model (primary)  | OpenRouter fallback   |
| ---------- | ------------------------- | --------------------- | --------------------- |
| `fast`     | Low latency, demos        | `openai/gpt-oss-20b`  | `openai/gpt-oss-20b`  |
| `balanced` | Default generation        | `openai/gpt-oss-120b` | `openai/gpt-oss-120b` |
| `smart`    | Higher-quality generation | `qwen/qwen3.8-27b`    | `qwen/qwen3.8-27b`    |

`AI_DEFAULT_MODEL` defaults to `balanced`.

The alias→provider-id mapping lives in the gateway provider-profile config (Issue 2), not in the client-facing schema. `AI_MODELS` in `@repo/schemas` lists only the aliases.

### Reasoning

Requests set `reasoning_effort: 'low'` for `openai/gpt-oss-*` models (they do not accept `none`) and `'none'` for every other model; see `gatewaySettings` in `apps/api/src/ai/ai-gateway.service.ts`. Whether Groq honors `none` is measured by the probe runs in [`docs/model-report-v3.md`](../model-report-v3.md). Reasoning models inflate a five-card job from ~250 tokens to ~2,000 tokens and add 26–56s of latency. `stripThinking()` remains as a safety net in case a provider ignores the hint.

### Cost model (per five-card job)

| Alias      | Model                 | Input    | Output  | Est. tokens (5 cards) | Est. cost     |
| ---------- | --------------------- | -------- | ------- | --------------------- | ------------- |
| `fast`     | `openai/gpt-oss-20b`  | $0.075/M | $0.30/M | ~400 in / ~250 out    | < $0.01       |
| `balanced` | `openai/gpt-oss-120b` | $0.15/M  | $0.60/M | ~400 in / ~250 out    | < $0.02       |
| `smart`    | `qwen/qwen3.8-27b`    | $0.80/M  | $4.00/M | ~400 in / ~250 out    | ~ $0.01–$0.02 |

Costs are cents-per-demo scale. OpenRouter keys carry a hard credit cap to prevent billing surprises.

The production demo budget is approximately $10. Verify both credentials before
deployment without printing them:

```bash
curl --fail -H "Authorization: Bearer $GROQ_API_KEY" \
  https://api.groq.com/openai/v1/models >/dev/null
curl --fail -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  https://openrouter.ai/api/v1/models >/dev/null
```

### Moderation deferral

Deck content moderation is bypassed for the duration of this migration via `MODERATION_ALLOW_ALL=1`; the publish gate skips classifiers for tests and demos. Report recording and manual takedown endpoints remain live, but no `deck_moderation` re-check is enqueued while the flag is set: the report response returns `recheck: 'skipped'`. The api's boot-time sweep that fails pending `deck_moderation` jobs is gated on the same flag: when the flag is removed to restore fail-closed moderation, the sweep must be removed with it (or it will silently disable report-triggered re-checks across restarts). Re-hosting production moderation (two classifiers, fail-closed) is a separate follow-up epic.

## Consequences

### Positive

- No dependency on the ex-teammate's GX10 or tailnet.
- OpenAI-compatible endpoints keep the api client contract unchanged.
- `AI_MOCK=1` still covers key-less demo runs.
- Failover to OpenRouter provides resilience against Groq outages/rate limits.

### Negative

- Generation content leaves our infrastructure and reaches third-party providers (acceptable for a demo/school project; see privacy note in README).
- OpenRouter fallback chains can land on paid models; hard credit caps mitigate spend risk.
- `gpt-oss-*-safeguard` dev-tier rate limits are tight if moderation is later re-hosted on Groq (see follow-up epic).

## Related

- `docs/ai-generation.md` — AI generation flow (links this ADR)
- `docs/deployment.md` — Deployment and VPS migration
- Issue 2 — Gateway provider profiles + failover in app code
- Follow-up epic — Re-host deck moderation after the hosted generation
  migration; remove `MODERATION_ALLOW_ALL=1` and restore fail-closed checks.
