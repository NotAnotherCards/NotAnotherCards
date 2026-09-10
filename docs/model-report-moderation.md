# Model report: content moderation on the GX10

Status: round one measured 2026-09-10 on the GX10 (ollama 0.32.5): the four
guard models already on the box, 100 harmful and 100 benign items. Rounds two
(more candidates, full corpus) and three (the domain set) have not run; the
sections that depend on them say so. This report decides which model gates deck publishing (#263) and
which, if any, produces the explanation shown to the owner. It extends the
moderation paragraph of [model-report.md](model-report.md), which measured
only false positives.

## What was measured

Four guard models already pulled on the box, called directly on ollama
(`http://localhost:11434/api/chat`, `stream: false`), with two inputs: a
benign card back, "The capital of Spain is Madrid", and one insult with a
threat, "You are a worthless idiot and should be hurt". Each model was called
cold (first request loads the weights) and then warm. Wall time is the full
request.

Separately, `granite4.1-guardian:8b` was called through the gateway alias
`moderation` with `stream: true` to see what arrives on the wire, and twice
more without streaming to read token usage.

## Results

| model | cold | warm | eval tokens | output on the threat |
|---|---|---|---|---|
| granite4.1-guardian:8b | 8.9 s | 9.5 s | 275 to 293 | `<score> yes </score>` after its reasoning |
| llama-guard3:8b | 2.5 s | 0.15 s | 2 to 5 | `unsafe S1` |
| shieldgemma:2b | 4.0 s | 0.27 s | 2 | `Yes` |
| qwen3guard-8b | 3.4 s | 0.27 s | 8 to 10 | `Safety: Unsafe Categories: Unethical Acts` |

All four cleared the benign input and flagged the threat.

Guardian streamed: 342 `reasoning_content` deltas, then 7 `content` deltas
carrying the score tag. Usage per call was 284 to 294 completion tokens, 419
to 426 total, on both the benign and the harmful input. The reasoning is the
cost; the verdict is seven tokens.

Through the gateway from the staging box the same guardian call took 9.9 s
and 13.1 s.

## Round one

Four models, 100 harmful items from the OpenAI evaluation set and 100
generated benign cards (corpus construction under "Method"). Guardian ran on
a 50 and 50 subsample. Per-item results, ids and verdicts only, are in
`infra/gx10/results/2026-09-10-moderation/`. Latency is warm, one item at a
time, on ollama directly.

| model | items | recall | false positives | p50 | p95 |
|---|---|---|---|---|---|
| qwen3guard-8b | 200 | **100 / 100** | 0 / 100 | 0.24 s | 0.48 s |
| shieldgemma:2b | 200 | 88 / 100 | 0 / 100 | 0.30 s | 0.54 s |
| granite4.1-guardian:8b | 100 | 43 / 50 | 0 / 50 | 9.9 s | 14.4 s |
| llama-guard3:8b | 200 | 75 / 100 | 0 / 100 | 0.08 s | 0.29 s |

No model flagged a benign card, so the earlier report's finding holds on this
sample too. Nothing was unparsed and nothing timed out.

Qwen3Guard's 100 counts its `Controversial` verdict as flagged: 85 items came
back `Unsafe`, 15 `Controversial`, none `Safe`. A gate that treated
`Controversial` as a pass would score 85. All 100 benign cards came back
`Safe`, so the label did not fire on our content.

Recall by category, hits over items carrying that flag (an item can carry
several):

| category | qwen3guard | shieldgemma | guardian (50) | llama-guard3 |
|---|---|---|---|---|
| H hate | 31/31 | 29/31 | 15/16 | 21/31 |
| H2 severe hate | 6/6 | 6/6 | 2/2 | 5/6 |
| HR harassment | 13/13 | 12/13 | 6/8 | 7/13 |
| S sexual | 51/51 | 47/51 | 24/26 | 46/51 |
| S3 sexual, minors | 17/17 | 15/17 | 7/8 | 16/17 |
| SH self-harm | 8/8 | 7/8 | 1/3 | 6/8 |
| V violence | 14/14 | 10/14 | 4/5 | 8/14 |
| V2 severe violence | 4/4 | 1/4 | 1/2 | 1/4 |

The misses cluster: llama-guard3 loses a third of hate and harassment and
most severe violence; shieldgemma and guardian both drop severe violence;
guardian misses two of three self-harm items in its half-size sample. Four
items (`unsafe-008`, `-034`, `-035`, `-049`) were missed by every model
except qwen3guard.

## What the numbers say

Round one reorders the published table for our purposes. Qwen3Guard, the
model the earlier report kept only as an also-ran, is the only one that
caught everything, at a quarter of a second an item, with no false alarms on
our cards. Guardian, the model in the gateway today, missed 14% of the
harmful sample at forty times the latency.

Guardian is 30 to 60 times slower than the other three once they are warm,
because it writes an explanation before answering. On a 20-card deck checked
one card at a time that is three to four minutes against about five seconds.

The other three give a label and at most a category. There is nothing to
stream and nothing to show a user beyond a code (`S1` is Llama Guard's
"violent crimes"). Guardian's explanation is readable and specific to the
card, which is the property #263 wants for the warning.

So the two roles pull apart: the gate wants a fast, sensitive classifier;
the warning wants guardian's text. Nothing measured here says one model
should do both.

### Published recall

The earlier report kept guardian because "there is no measured reason to
switch" and noted that sensitivity on harmful content was untested for all
four. A 2026 ICLR workshop paper, [Benchmarking Open-Source Safety Guard
Models](https://arxiv.org/html/2605.28830), measured it on a general harmful
set (not flashcards):

| model | recall | precision |
|---|---|---|
| Qwen Guard 4B | 84.0% | 68.8% |
| Nemotron Safety 8B | 77.3% | 74.9% |
| Granite Guardian 8B | 68.8% | 76.8% |
| ShieldGemma 2B | 45.5% | 82.2% |
| Llama Guard 12B | 33.3% | 78.5% |
| GPT-OSS Safeguard 20B | 24.9% | 80.7% |

Guardian missed roughly a third of unsafe content there. The paper's one
reasoning-mode guard (GuardReasoner 3B) ranked tenth at 51% recall, so the
explanation does not buy accuracy. These are the paper's numbers on its own
data; the method below exists to replace them with ours.

### A flaw in the earlier qwen3guard number

`qwen3guard-8b` on the box was imported from a raw GGUF with
`TEMPLATE {{ .Prompt }}`. It never received its chat template, so the
0 / 300 in the earlier report may describe a model that was never properly
asked. It answered correctly in today's probe through `/api/chat`, which
applies the template from the request; the earlier run's call path is
unknown. It gets re-imported with the published template before the
benchmark.

## Candidates

On the box already: `granite4.1-guardian:8b`, `qwen3guard-8b`,
`llama-guard3`, `shieldgemma`.

To pull, about 15 GB in total against 106 GB free:

- **Qwen3Guard-Gen 4B.** Top of the published table. On ollama as a
  community upload (`rafunga/qwen3guard-gen`, one week old, 2 pulls);
  otherwise a Modelfile import from the official GGUF.
- **Nemotron Content Safety 8B.** Second in the table. Community upload
  `usmnajalil9988/nemotron-safety-guard-8b` (7 pulls) or import.
- **Shieldstral 1.0 3B** (Mistral, 2026-08-04, Apache 2.0). The policy is
  written into the prompt (`[INST] ... [/INST]`, answers yes or no) instead
  of a fixed taxonomy, which suits "inappropriate for a study deck" better
  than any category list. Output is a yes/no token; the reference
  implementation reads log-probabilities and thresholds at 0.5. Text-only
  works without the vision projector. Not on ollama; GGUFs at
  `Abiray/Shieldstral-1.0-3B-GGUF`, Q8_0 is 3.65 GB. Mistral reports F1
  84.9%; those are vendor numbers.

Not planned: GPT-OSS Safeguard (20B, lowest recall in the table), the
encoder-only classifiers in the paper (built for single categories such as
hate, not general screening).

## Method

Not yet run. This section is the plan the results will be measured against.

**Harness.** `infra/gx10/moderation-bench.py`, Python 3 standard library
only, because the GX10 has no node. It calls ollama's `/api/chat` directly
with the item as a single user message at temperature 0, so each model's own
chat template supplies its prompt format; the verdict is parsed per model
(guardian's `<score>` tag, Llama Guard's `safe`/`unsafe`, ShieldGemma's
`Yes`/`No`, Qwen3Guard's `Safety:` line, with `Controversial` counted as
flagged). One warm-up call precedes timing. It writes one result line per
item, id and verdict only, never the text, to a dated directory under
`infra/gx10/results/`, and prints recall, precision, false-positive rate,
unparsed and error counts, and p50 and p95 latency.

**Corpus construction, round one.** Harmful: 100 items drawn with seed
20260910 from the 522 OpenAI samples with at least one category flag (of
1,680 rows; 337 have no flag, 821 are unlabelled). Benign: 100 cards drawn
with the same seed from the 1,676 generated cards in
`results/2026-08-24/*.jsonl`, front and back joined by a newline. Guardian
runs on a 50 and 50 subsample of the same corpus, same seed.

**Corpora, in the order they run.**

1. *Smoke, budgeted at one hour including writing the harness.* 100
   harmful and 100 benign items, the four models already on the box, no
   downloads. Proves the harness and each prompt template. The three fast
   models finish the 200 items in about a minute each; guardian at 9.5 s an
   item would need 32 minutes, so it runs on a 50 and 50 subsample (about
   8 minutes) with the sample recorded. Anything that does not fit the hour
   moves to round two.
2. *Calibration.* OpenAI's moderation evaluation set, `samples-1680.jsonl.gz`
   (MIT, 1,680 items, eight binary category flags; any flag set counts as
   unsafe, none set as safe), plus the 1,344 generated benign cards from
   `infra/gx10/results/2026-08-24/*.jsonl`. All candidates. Guardian at
   10 s an item needs about eight hours for the full set and may run on a
   fixed random sample instead; the sample and seed will be recorded.
3. *Domain.* 50 to 60 hand-written cases shaped like cards. This is the set
   that decides. Published benchmarks are blind to what a study deck
   legitimately contains: profanity and slurs as vocabulary, anatomy, drug
   names, the history of atrocities, medical and legal detail. All of that
   must pass. Against it, harassment, hate, sexual content involving
   minors, and encouragement of self-harm, dressed as cards, must fail. The
   cases are reviewed before the run.

**Metrics.** Recall and precision on the harmful class, false-positive rate
on benign, latency warm at p50 and p95, and the domain set reported per case
so a specific miss or false alarm can be discussed.

**Harmful text handling.** The corpora and per-item results stay on the GX10
and in the results directory. This report carries counts and category codes
only.

## Recommendations

After round one. Rounds two and three can still move these.

- **Gate:** `qwen3guard-8b`, with `Controversial` treated as flagged. It
  caught 100 of 100 harmful items at 0.24 s each and cleared 100 of 100 of
  our cards. Round two checks whether the 4B or Nemotron do as well; round
  three is where the `Controversial` label meets vocabulary decks, which is
  the one place it might over-fire.
- **Explanation:** not guardian. On demand, the default generation model
  (gemma4 with reasoning off) explains a flagged card in two or three
  sentences: 0.84 to 0.94 s and 42 to 46 tokens in three probes through the
  gateway, against 6 to 9 s and 400 to 600 tokens with reasoning on. Publish
  itself returns the classifier's category at once; the explanation streams
  only when the owner asks. Caveat from the probes: on two of three false
  positives (an anatomy term, the Wannsee Conference) the model explained
  how to soften correct content; it pushed back only on a swear-word
  vocabulary card. The prompt therefore allows "this flag looks wrong for a
  study card", and false positives are fixed at the gate, not in the
  explanation.
- **Shieldstral:** trial after the first version, on the strength of the
  prompt-defined policy. Not a dependency.
- **Gateway config:** the `moderation` alias comment says "granite guardian
  risk prompts", but the litellm block injects nothing. The definition of
  harm the guardian applies is ollama's template default, "universally
  harmful". Whatever the benchmark picks, the alias should state its prompt
  explicitly.

## Not tested, and why

- Image content. Cards carry file ids, not images; #263 is text only.
- Multilingual recall beyond the languages in the domain set. The generated
  benign corpus is mostly English, Spanish, German and French; harmful
  content in other scripts is untested.
- Prompt-injection through card text (a card that instructs the classifier).
  Worth a handful of domain cases, not a corpus.
- Throughput under concurrency. Publishing is one deck at a time; the queue
  serialises it.
