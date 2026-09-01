# Model report v2: flashcard generation on the GX10

Status: measured 2026-08-22 to 2026-08-24 on the GX10 with Ollama 0.32.15.
This report replaces the earlier model comparison for current generation
choices. The previous report remains as a record of older models and test
conditions.

Raw outputs, judge results, prompts, and summary scripts are stored in
`infra/gx10/results/2026-08-24/`.

## Recommendation

Use `gemma4:26b-a4b-it-q4_K_M` as the default interactive flashcard
generator. It produced 50/50 parseable sets, had the lowest adjudicated issue
rate, and generated a general five-card set in a median 3.49 seconds. Its
language median was 2.01 seconds.

Keep `qwen3.6:35b` as the low-latency fallback. It was about 0.8 seconds
faster on the general suite, but produced 14 adjudicated issues in 236 cards
against Gemma's 10 in 240, and one of its 50 sets did not parse.

Do not assign a production slot to the other five candidates from this run:

- Muse Glimmer matched Gemma's quality within this sample, but took about 17
  seconds per set. It provides no useful quality or latency advantage.
- Qwen 3.8 was slower and less accurate than Qwen 3.6.
- Ornith, Nemotron, and Laguna were fast, but their error rates were too high.

The local Qwen/MiniCheck review pass is not sufficient as the only verifier.
It found 63 of the 164 issues accepted by the final adjudicator. A queued
verification path needs a stronger judge, and source-grounded generation
should still use a dedicated claim checker.

## Results

Each latency is the median wall-clock time for one request producing four or
five cards. Major and minor counts come from the adjudication process
described below. Issue rate is `(major + minor) / parsed cards`.

| model                                   | format | cards | general median | language median | decode tok/s | major | minor | issue rate |
| --------------------------------------- | -----: | ----: | -------------: | --------------: | -----------: | ----: | ----: | ---------: |
| `gemma4:26b-a4b-it-q4_K_M`              |  50/50 |   240 |         3.49 s |          2.01 s |         53.0 |     3 |     7 |       4.2% |
| `muse-glimmer:30b-q4_K_M`               |  50/50 |   240 |        17.33 s |         17.14 s |         12.4 |     5 |     6 |       4.6% |
| `qwen3.6:35b`                           |  49/50 |   236 |         2.67 s |          2.13 s |         76.0 |     7 |     7 |       5.9% |
| `qwen3.8:27b`                           |  50/50 |   240 |         6.31 s |          5.25 s |         29.7 |    12 |    14 |      10.8% |
| `ornith-1.5:35b`                        |  50/50 |   240 |         2.62 s |          1.60 s |         77.2 |    16 |    14 |      12.5% |
| `nemotron-3.5-lightning:30b-a3b-q4_K_M` |  49/50 |   235 |         1.72 s |          1.47 s |         89.9 |     8 |    25 |      14.0% |
| `laguna-xs-2.1:q4_K_M`                  |  50/50 |   240 |         1.93 s |          1.64 s |         94.1 |    21 |    19 |      16.7% |

Decode rate is the median from the general campaign. The language extension
recorded request latency and token counts, but not Ollama's decode duration.

The exact builds were:

| model                                   | family           | parameters reported by Ollama | quantization | thinking |
| --------------------------------------- | ---------------- | ----------------------------: | ------------ | -------- |
| `gemma4:26b-a4b-it-q4_K_M`              | `gemma4`         |                         25.8B | Q4_K_M       | off      |
| `muse-glimmer:30b-q4_K_M`               | `muse-glimmer`   |                         27.9B | Q4_K_M       | off      |
| `qwen3.6:35b`                           | `qwen35moe`      |                         36.0B | Q4_K_M       | off      |
| `qwen3.8:27b`                           | `qwen35`         |                         27.3B | Q4_K_M       | off      |
| `ornith-1.5:35b`                        | `qwen35moe`      |                         35.5B | Q4_K_M       | off      |
| `nemotron-3.5-lightning:30b-a3b-q4_K_M` | `nemotron_h_moe` |                         32.9B | Q4_K_M       | off      |
| `laguna-xs-2.1:q4_K_M`                  | `laguna`         |                         33.4B | Q4_K_M       | off      |

The tags for Gemma and Nemotron identify about 4B and 3B active parameters,
respectively. Ollama reports total parameters in the table above.

## Test design

The run made 50 generation requests per model:

- 30 general requests: five runs each for Spanish preterite, photosynthesis,
  German source comprehension, French Revolution dates, JavaScript array
  methods, and music intervals.
- 20 language requests: five runs each for German articles and plurals,
  Spanish `ser` versus `estar`, German word cards, and German cloze cards.

The prompt requested a JSON array of `{front, back}` objects, with each side
under 20 words. General topics requested five cards. The two source-text
topics requested four cards. Generation ran sequentially through Ollama's
native `/api/chat` endpoint after an excluded warm-up request. Thinking was
disabled for every model.

The campaign requested 350 sets. It parsed 348 and extracted 1,671 cards.
Qwen 3.6 and Nemotron each had one malformed set. Format success only means
that the response parsed as the requested array; prompt compliance and card
quality are counted separately.

This is a stochastic sample, not a proof that small differences will persist.
Each model saw five runs per topic, and only one quantized build of each model
was tested. The gap between Gemma, Muse, and Qwen is small enough that a rerun
could change their order. Muse's latency gap is large and does not depend on
that ordering.

## Quality review

The review used three stages. Generator identities were hidden from every
judge.

1. The local first pass checked every card. `qwen3.6:35b` in thinking mode
   judged open-domain cards. `bespoke-minicheck:7b` checked the two topics with
   supplied German source text. This pass flagged 76 cards.
2. Claude Opus 5 reviewed all 1,671 cards through the Claude Code
   subscription, with no tools or web access. It returned 1,477 `ok`, 192
   `error`, and 2 `uncertain` verdicts.
3. Claude Fable 5 adjudicated all 192 Opus errors, both uncertain verdicts,
   and the 10 local flags that Opus accepted. Fable received the exact
   generation prompt and all cards from the same generated set. It did not
   receive model names or prior verdicts.

Fable assigned these dispositions:

- `major_error`: wrong fact, false rule, answer mismatch, wrong card type, or
  malformed enough that the card cannot be used as written.
- `minor_error`: correct core content that still needs a wording, grammar,
  scope, or qualification fix.
- `judge_false_positive`: acceptable under the original prompt and deck
  context.

No card remained unresolved, and none was classified as duplicate-only.

| final disposition                 | cards | share of all cards |
| --------------------------------- | ----: | -----------------: |
| accepted without Fable escalation | 1,467 |              87.8% |
| major error                       |    72 |               4.3% |
| minor error                       |    92 |               5.5% |
| judge false positive              |    40 |               2.4% |

These are model-judge results, not human fact-checks. Opus reviewed every
card, but Fable only reviewed the 204 cards escalated by Opus or the local
pass. Neither cloud judge used web search. Exact dates, specialist terms, and
language edge cases can still be misjudged.

## Judge comparison

The Fable disposition is used as the reference for this comparison.
"Escalated" means the judge returned an error, uncertain result, or local
flag. Precision is the share of escalations that Fable classified as major or
minor. Recall is the share of all 164 adjudicated issues that the judge
escalated.

| judge                     | escalated | issues among escalations | false alarms | missed issues | precision | recall |
| ------------------------- | --------: | -----------------------: | -----------: | ------------: | --------: | -----: |
| local Qwen/MiniCheck pass |        76 |                       63 |           13 |           101 |     82.9% |  38.4% |
| Opus                      |       194 |                      160 |           34 |             4 |     82.5% |  97.6% |

The local pass caught 40 of 72 major errors and 23 of 92 minor errors. It
missed 32 major and 69 minor errors. The result is useful as a cheap screen,
but it materially understates model error rates.

Opus caught 71 of 72 major errors and 89 of 92 minor errors. The four misses
were found because the local pass had independently flagged those cards.
Fable rejected 34 Opus escalations as false positives. Many came from judging
a card without the full deck prompt, especially cards that relied on a
Spanish-preterite topic already stated to the learner.

## Results by topic

| topic                        | cards | major | minor | issue rate |
| ---------------------------- | ----: | ----: | ----: | ---------: |
| Spanish preterite            |   175 |    10 |     8 |      10.3% |
| Photosynthesis               |   175 |     0 |     5 |       2.9% |
| German source comprehension  |   140 |     4 |    13 |      12.1% |
| French Revolution dates      |   170 |     9 |    12 |      12.4% |
| JavaScript array methods     |   175 |     3 |    10 |       7.4% |
| Music intervals              |   175 |    11 |    17 |      16.0% |
| German articles and plurals  |   175 |    11 |     4 |       8.6% |
| Spanish `ser` versus `estar` |   175 |     6 |     7 |       7.4% |
| German word cards            |   175 |    14 |    12 |      14.9% |
| German cloze cards           |   136 |     4 |     4 |       5.9% |

Biology was the safest topic and produced no major errors. Music remained
the hardest general topic. Models confused semitone counts, scale-degree
counts, and interval names. French Revolution cards often had correct dates
attached to malformed questions, especially passive constructions involving
Louis XVI's execution.

The German word-card prompt exposed a different failure mode. Several models
reversed the requested card direction, omitted the target verb, or supplied
an example sentence that did not match the translation. German articles also
separated the models: Laguna and Qwen 3.8 produced most of that topic's major
errors.

## Model notes

### Gemma 4 26B-A4B

Gemma had 3 major and 7 minor errors in 240 cards. All 95 cards in the four
language-specific topics were accepted. Its issues were concentrated in
French Revolution wording, music terminology, and one German source card.
It was slower than the fastest MoE models, but still stayed below four seconds
per general set.

This is the best measured default. The 4.2% issue rate is not low enough to
skip verification. Compared with Qwen 3.6, Gemma avoided four issues at a
cost of 0.83 seconds per general set. This recommendation prefers that quality
gain over the small latency saving.

### Muse Glimmer 30B

Muse had 5 major and 6 minor errors in 240 cards. Four major errors came from
Spanish cards where a correct conjugated form was followed by a false rule,
such as calling a regular verb irregular. Its core answers were often good;
extra explanation created the error.

The quality result is close to Gemma, but a median 17 seconds per set removes
it from both the interactive and queued recommendations. It does not improve
accuracy enough to pay that latency cost.

### Qwen 3.6 35B

Qwen had 7 major and 7 minor errors in 236 parsed cards. It remained fast at
2.67 seconds for the general suite and 2.13 seconds for language prompts. One
set failed to parse.

It remains a useful fallback and comparison baseline. The judge experiment
also shows why it should not verify its own generation without another check:
the local pass found only 38.4% of the final issue set across all models.

### Qwen 3.8 27B

Qwen 3.8 had 12 major and 14 minor errors. Its dense architecture decoded at
29.7 tokens per second and took more than twice as long as Qwen 3.6 on the
general suite. The run gives it no production role.

### Ornith 1.5 35B

Ornith had 16 major and 14 minor errors. It was fast, but German source cards,
German word cards, Spanish, history, and music all contributed major errors.
It did not establish a quality or latency advantage over Qwen 3.6.

### Nemotron 3.5 Lightning 30B-A3B

Nemotron had 8 major and 25 minor errors, plus one malformed set. It was the
second-fastest model by decode rate and the fastest by request latency. Many
of its problems were wording and scope rather than wrong core facts, but the
14.0% combined issue rate is too high for generated study material.

This run used the GGUF Q4_K_M build, not NVFP4. A native NVFP4 run on the
GX10's Blackwell hardware is worth measuring for throughput. Quantization is
unlikely to fix the content-quality gap, so that test should be treated as a
serving benchmark rather than an expected accuracy upgrade.

### Laguna XS 2.1

Laguna decoded fastest at 94.1 tokens per second and parsed all 50 sets. It
also had the most errors: 21 major and 19 minor. German word cards and German
articles accounted for much of the damage. Speed does not compensate for a
16.7% issue rate.

## Todo

### Serving and quantization

- [ ] Benchmark `gemma4:26b-a4b-it-qat` through Ollama with the same 50-set
      suite. Compare format success, major and minor errors, latency, decode
      rate, and memory with the current Q4_K_M build.
- [ ] Serve `nvidia/Gemma-4-26B-A4B-NVFP4` through vLLM on the GX10. Measure
      latency, sustained throughput, concurrency, and memory before running
      the full quality suite. Use the NVIDIA Blackwell checkpoint, not the
      MLX-labelled Ollama tag.

### Local judge benchmark

- [ ] Freeze the 204 Fable-labelled cards as the judge recall set. Add a
      stratified Fable-reviewed sample from the 1,467 non-escalated cards so
      false-positive rates are measured on ordinary cards as well.
- [ ] Test Gemma 4, Qwen3-Next 80B, Mistral Small 3.2, and future local judge
      candidates with the exact generation prompt and generated set available
      to each judge.
- [ ] Report major recall, minor recall, false-positive rate, latency, memory,
      and results split by topic. Do not select a judge from one aggregate
      score.
- [ ] Add a dedicated `judge` gateway alias and update the GX10 documentation
      only after the comparison. Until then, the local Qwen/MiniCheck pass is
      a screen, not a quality gate.

### Remaining generation comparisons

- [ ] Rerun `qwen3-next:80b` and `mistral-small3.2` on the 50-set suite with
      the same Opus and Fable review method. Their older results are not
      directly comparable with this table.

Do not rerun Qwen 3.8 for deployment selection unless its weights or serving
stack change materially. Its earlier NVFP4 plus MTP latency test did not close
the gap with Qwen 3.6.

## Reproduction

The preserved directory contains:

- `driver.mjs` and `gen-lang.mjs`: generation prompts and campaign drivers.
- `*.jsonl`: raw generation responses, timing metadata, parsed cards, and
  model metadata.
- `audit.mjs` and `*.audit.json`: local Qwen/MiniCheck review.
- `opus-audit.mjs` and `opus-adjudication.json`: full Opus review.
- `adjudication/fable-adjudicate.mjs` and `adjudication/fable.json`: Fable
  adjudication of the 204-card review set.
- `adjudication/summarize.mjs` and `adjudication/summary.json`: deterministic
  aggregation used for this report.

Regenerate the summary with:

```sh
node infra/gx10/results/2026-08-24/adjudication/summarize.mjs
```
