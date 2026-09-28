# Contextual publish moderation (#450)

Publishing screens one input per note from the immutable snapshot. Word
inputs contain the word, translation, examples, other textual fields and
the deck's language names. Basic notes retain their text without claiming
that arbitrary prose is educational. Additional note content and rendered
card text differing from the templates are also screened.

Qwen3Guard's unsafe findings go to `AI_DEFAULT_MODEL`. Its input is JSON
data with a separate system policy, and its response must be exactly a
`confirm` or `warn` verdict with a nonempty reason. A warning is the only
successful override. Errors, timeouts and invalid responses keep the
refusal. The judge shares the existing capped deadline. Results expand to
the sibling card IDs, so clients need no response-schema change.

Reports and their independent, per-card thorough checks are unchanged.

## Reproduce the benchmark

The existing 100 harmful and 100 benign examples are in
`~/moderation-bench/corpus-200.jsonl` on GX10. Do not commit their text.
The TypeScript exporter uses the production context builder, including the
canonical card-template keys. From the repository root:

```sh
pnpm --filter './packages/**' build
pnpm --filter api exec tsx scripts/moderation-bench-inputs.ts corpus /tmp/corpus-200.jsonl > /tmp/context.jsonl
node decks/build.mjs decks/spanish-a1.txt > /tmp/spanish.json
pnpm --filter api exec tsx scripts/moderation-bench-inputs.ts deck /tmp/spanish.json > /tmp/spanish-context.jsonl
```

The TypeScript benchmark runs locally against an OpenAI-compatible gateway
or an SSH tunnel to Ollama's `/v1` endpoint. GX10 does not need Node.
Publish mode calls the actual `ModerationService`, including its policy,
strict response parser and deadlines. Only the direct-Ollama model alias
is expanded by the harness. For a local tunnel on port 14500:

```sh
pnpm --filter api exec tsx scripts/moderation-bench.ts --mode raw \
  --base http://127.0.0.1:14500/v1 --model qwen3guard-8b:latest \
  --corpus /tmp/corpus-200.jsonl --out /tmp/baseline-results.jsonl
pnpm --filter api exec tsx scripts/moderation-bench.ts --mode publish \
  --base http://127.0.0.1:14500/v1 --model qwen3guard-8b:latest \
  --judge-model gemma4:26b-a4b-it-q4_K_M \
  --corpus /tmp/context.jsonl --out /tmp/context-results.jsonl
pnpm --filter api exec tsx scripts/moderation-bench.ts --mode publish \
  --base http://127.0.0.1:14500/v1 --model qwen3guard-8b:latest \
  --judge-model gemma4:26b-a4b-it-q4_K_M \
  --corpus /tmp/spanish-context.jsonl --out /tmp/spanish-results.jsonl
```

As in the original report, recall counts both refusals and warnings.
`refused_unsafe` and `downgraded_unsafe` additionally track whether the judge
weakens blocking. Errors (including unparseable outputs) must be zero for a clean
comparison; they are reported separately, not silently counted as passes.

### Measured TypeScript results

With Qwen3Guard `qwen3guard-8b:latest` and judge
`gemma4:26b-a4b-it-q4_K_M` on GX10 (Ollama 0.32.15):

| Run                                    | Harmful flagged | Harmful refused | Benign flagged | Errors |
| -------------------------------------- | --------------- | --------------- | -------------- | ------ |
| Raw baseline, 200 items                | 100/100         | 85/100          | 0/100          | 0      |
| Production publish pipeline, 200 items | 100/100         | 84/100          | 0/100          | 0      |
| Spanish A1, 513 notes                  | n/a             | n/a             | 0/513          | 0      |

The judge downgraded `unsafe-035` to a warning. Thus the original
warning-inclusive recall criterion passes, but blocking is **not unchanged**:
one harmful-labelled item that was refused can now publish. Do not present
this as equivalent safety performance. A previous Python/native-Ollama run
retained all 85 refusals; the TypeScript run through the production HTTP
path is the relevant result. After reviewing the exact example (commentary
about inadequate sex education containing an explicit sexual phrase), the
maintainer accepted its warning downgrade. The accepted result is 84
refusals and 16 warnings across the 100 harmful-labelled items, not 100
refusals; the dataset label is not an independent determination of harm.

All 85 judge requests completed without judge errors. Baseline p50/p95
latencies were 307/414 ms; publish corpus 319/1723 ms; Spanish notes
244/319 ms. These are individual-note timings, not whole-deck timings.
The separate live publication integration test also published the Spanish
snapshot and verified its persisted 513 notes and 1,539 cards through a
second user's public preview.

## Endpoint and failure checks

`moderation.service.spec.ts` covers confirmed refusals, false positives,
all sibling IDs, invalid verdicts, HTTP/network failures and timeouts.
`sharing.test.ts` exercises publication, persistence, visibility and
preview through the real moderation service with controlled model replies.

Optional live tests use `MODERATION_LIVE_API_BASE` (an OpenAI-compatible
`/v1` endpoint), `MODERATION_LIVE_API_KEY`, and
`MODERATION_LIVE_JUDGE_MODEL`. A direct Ollama run can set
`MODERATION_LIVE_FAST_MODEL=qwen3guard-8b:latest` to expand the gateway
alias while retaining real HTTP, production parsing and timeouts.

With these variables and an isolated `TEST_DATABASE_URL`, run:

```sh
pnpm --filter api exec jest --runInBand
pnpm --filter api exec vitest run --config vitest.sync.config.ts test/sync/sharing.test.ts
```

The live unit cases test both a neutral vocabulary false positive and a
confirmed threat. The live endpoint case builds the actual Spanish A1
sample, publishes its 513 notes and 1,539 cards, and checks that another
user can preview the persisted public snapshot. Use a dedicated test
database server: the fixture cleans up databases with its test prefix.

The policy, exporter and benchmark corpus shape must be rerun together if
the prompt or model changes. Early experiments demonstrated why: blanket
educational framing reduced recall, and ambiguous `confirm` wording made
the model confirm that benign content was safe while keeping its refusal.
