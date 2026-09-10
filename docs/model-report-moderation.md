# Content moderation

Status: round one measured 2026-09-10 on the GX10 (ollama 0.32.5): the four
guard models already on the box, 100 harmful and 100 benign items. Rerun any
row with `infra/gx10/moderation-bench.py`. This report decides which model
gates deck publishing (#263) and how the owner of a refused deck learns why.
Rounds two (more candidates, the full corpus) and three (study-deck cases)
have not run; the sections that depend on them say so.

The harmful texts are not in this repository and not in this report. The
per-item files under `infra/gx10/results/2026-09-10-moderation/` carry an
id, a label and a verdict per item, nothing else. The texts come from a
public dataset and the sample is reproducible from its file and a seed (see
"Method"); on the GX10 they sit in `~/moderation-bench/`. Where an item is
discussed below it is described, not quoted.

## What was measured

**Round one.** Four models over 200 items: 100 harmful, drawn from the
OpenAI moderation evaluation set, and 100 benign, drawn from cards our own
generation models produced. Each item went to each model as a single user
message at temperature 0 through ollama's `/api/chat`, so every model used
its own chat template. Guardian ran on a 50 and 50 subsample of the same
corpus, because it needs ten seconds an item. Latency is warm, one request
at a time, after a warm-up call.

**Probes.** Before the run, two inputs (a benign card back and one insult
with a threat) went to each model cold and warm, and to guardian with
streaming on to see what arrives on the wire. After the run, three probes
tested the default generation model, gemma4, as an on-demand explainer of a
flagged card, through the gateway, with reasoning on and off.

## Results

### Round one

| model | items | flagged of 100 harmful | flagged of 100 benign | p50 | p95 |
|---|---|---|---|---|---|
| qwen3guard-8b | 200 | 85 `Unsafe` + 15 `Controversial` | 0 | 0.24 s | 0.48 s |
| shieldgemma:2b | 200 | 88 | 0 | 0.30 s | 0.54 s |
| granite4.1-guardian:8b | 100 | 43 of 50 | 0 of 50 | 9.9 s | 14.4 s |
| llama-guard3:8b | 200 | 75 | 0 | 0.08 s | 0.29 s |

No model flagged a benign card. Nothing was unparsed and nothing timed out.

Qwen3Guard answers on three grades. Its `Unsafe` verdicts alone give 85 of
100; counting `Controversial` as flagged gives 100 of 100. Which count is
right depends on what the `Controversial` items are, and that is the main
finding of the round (next section). All 100 benign cards came back `Safe`.

By category, hits over items carrying that flag (an item can carry several;
qwen counts `Controversial` as a hit here):

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

33 of the 100 harmful items were missed by at least one model. Four
(`unsafe-008`, `-034`, `-035`, `-049`) were missed by every model except
qwen.

### The disagreed items, read

Reading the 33 disagreed items shows that the dataset labels content type,
not harm. Several items every other model cleared are descriptions that a
study deck would contain:

- `unsafe-034`, labelled violence: a paragraph on funeral customs across
  religions.
- `unsafe-006`, labelled violence: an encyclopaedia passage on dominance
  behaviour in bonobos.
- `unsafe-061`, labelled violence: someone listing their own injuries after
  an accident.
- `unsafe-064`, labelled hate: an anecdote about a dog let off its leash.
- `unsafe-077`, labelled self-harm: a comparison of smoking and drinking as
  unhealthy habits.

Qwen graded all five `Controversial`, and its `Unsafe` grade went to the
items that read as genuinely harmful (slurs at a group, harassment, sexual
content). So the 15 `Controversial` verdicts are what lifted qwen from 85 to
100, and at least six of the fifteen are texts a publishing gate must let
through. The other models' "misses" on these items are correct decisions.

Consequence: recall figures on the raw labels overstate every model's
misses, and a gate that blocks on `Controversial` would refuse a history
deck. The 33 disagreed items need a hand adjudication (harmful as study
content: yes or no) before a recall number is quoted as such; that is the
first task of round two.

### Probes

Latency and output, direct to ollama, warm:

| model | warm | eval tokens | output on the threat |
|---|---|---|---|
| granite4.1-guardian:8b | 9.5 s | 275 to 293 | `<score> yes </score>` after its reasoning |
| llama-guard3:8b | 0.15 s | 2 to 5 | `unsafe S1` |
| shieldgemma:2b | 0.27 s | 2 | `Yes` |
| qwen3guard-8b | 0.27 s | 8 to 10 | `Safety: Unsafe Categories: Unethical Acts` |

Guardian streams 342 `reasoning_content` deltas before the seven tokens of
its verdict; its usage is 284 to 294 completion tokens per call whatever the
input. The other three answer with a label and at most a category.

Gemma4 as an explainer, through the gateway, asked for two or three
sentences on why a flagged card falls under a given category and what to
change:

| setting | time | completion tokens |
|---|---|---|
| reasoning on (default) | 6.4 to 8.9 s | 428 to 605 |
| `think: false` | 0.84 to 0.94 s | 42 to 46 |

With reasoning off the answers were coherent and specific. On three
deliberate false positives (an anatomy term labelled sexual, a swear word as
vocabulary labelled hate, the Wannsee Conference labelled violence) it
pushed back once, on the swear word, and twice explained how to soften
correct content.

## What the numbers say

The gate and the explanation are different jobs, and no single model does
both well. Guardian writes an explanation before every verdict, which costs
ten seconds a card and buys nothing in accuracy: on the raw labels it caught
86% of the harmful sample, and the misses it shares with the others are
mostly the over-labelled items. A 20-card deck through guardian is three to
four minutes; through any of the other three, under ten seconds.

Qwen3Guard is the strongest gate on the harmful items that are actually
harmful, and its `Controversial` grade is a useful signal in its own right:
it separated "describes violence" from "is violent" more cleanly than the
labels did. Used as a block it over-fires on exactly the content a learning
app is full of. Used as a warning it is the one grade the owner might want
to see.

For explanations, the default generation model with reasoning off answers
in under a second and reads well. Its weakness is compliance: told a card
was flagged, it explains the flag even when the flag is wrong. The prompt
therefore allows it to say the flag looks wrong for a study card, and false
positives are fixed at the gate, not in the explanation.

The earlier generation report kept guardian for lack of a measured reason
to switch. Round one is that reason.

## Recommendations

- **Gate:** `qwen3guard-8b`. `Unsafe` blocks publication. `Controversial`
  does not block; it is shown to the owner as a warning on the card. Round
  three checks both grades against study-deck content.
- **Explanation:** on demand, from the default generation model with
  `think: false`, streamed, two or three sentences per flagged card, only
  when the owner asks. Publish itself returns the classifier's category at
  once. Guardian is not part of the design.
- **Gateway config:** the `moderation` alias moves from guardian to
  qwen3guard. Its litellm entry currently injects no prompt while its
  comment says it does; whatever the alias points at, the entry should state
  its prompt.
- **Before quoting recall again:** adjudicate the 33 disagreed items.

## Method

**Harness.** `infra/gx10/moderation-bench.py`, Python 3 standard library
only, because the GX10 has no node. It calls ollama's `/api/chat` with the
item as a single user message at temperature 0, parses the verdict per
model (guardian's `<score>` tag, Llama Guard's `safe`/`unsafe`, ShieldGemma's
`Yes`/`No`, Qwen3Guard's `Safety:` line), makes one warm-up call, and writes
one result line per item with id, label, flag, verdict grade, latency and
eval tokens. It prints recall, precision, false-positive rate, unparsed and
error counts, and p50 and p95 latency.

**Corpus.** Harmful: OpenAI's `samples-1680.jsonl.gz` (MIT; 1,680 rows with
eight binary category flags, of which 522 carry at least one flag, 337 carry
none and 821 are unlabelled); 100 of the 522 drawn with seed 20260910. Benign:
100 cards drawn with the same seed from the 1,676 generated cards in
`infra/gx10/results/2026-08-24/*.jsonl`, front and back joined by a
newline. Guardian's subsample is 50 per label from the same corpus with the
same seed. Reproducing the sample needs the dataset file and the seed; both
samples are also on the GX10 as `harmful-100.jsonl` and `benign-100.jsonl`.

**Rounds.**

1. *Done.* Four on-box models, 200 items, guardian on 100. One hour
   including the harness.
2. *Adjudication and candidates.* Hand-label the 33 disagreed items; rerun
   the recall column against the adjudicated labels. Add Qwen3Guard-Gen 4B,
   Nemotron Content Safety 8B and Shieldstral 3B (see "Candidates"), and the
   full 1,680 plus 1,676 for the fast models.
3. *Study-deck cases.* 50 to 60 hand-written card-shaped items: profanity
   and slurs as vocabulary, anatomy, drug names, the history of atrocities,
   medical and legal detail, all of which must pass; harassment of a named
   person, hate as a fact to memorise, self-harm and violence instructions,
   sexual content involving minors, all of which must fail. Reported per
   item, both qwen grades recorded, reviewed before it runs.

**Handling of harmful text.** Corpora and per-item texts stay on the GX10.
Results committed to the repository carry ids and verdicts only. This report
describes items and never quotes them.

## Candidates for round two

On the box already: `granite4.1-guardian:8b`, `qwen3guard-8b`,
`llama-guard3`, `shieldgemma`. `qwen3guard-8b` was imported from a raw GGUF
with `TEMPLATE {{ .Prompt }}`; through `/api/chat` it answered correctly in
every case here, but a re-import with the published template is cheap and
removes the doubt.

To pull, about 15 GB against 106 GB free:

- **Qwen3Guard-Gen 4B.** Top of the one independent benchmark of guard
  models we found ([ICLR 2026 workshop](https://arxiv.org/html/2605.28830),
  general harmful text, not cards: Qwen Guard 4B 84% recall, Nemotron 8B
  77%, Granite Guardian 8B 69%, ShieldGemma 45%, Llama Guard 12B 33%). On
  ollama as a community upload, or a Modelfile import.
- **Nemotron Content Safety 8B.** Second in that table. Community upload or
  import.
- **Shieldstral 1.0 3B** (Mistral, 2026-08-04, Apache 2.0). The policy is
  written into the prompt instead of a fixed taxonomy, which fits
  "inappropriate for a study deck" better than any category list. Answers
  yes or no; the reference implementation thresholds the token
  probabilities at 0.5. Text-only works without the vision projector. Not on
  ollama; GGUFs at `Abiray/Shieldstral-1.0-3B-GGUF`, Q8_0 is 3.65 GB.
  Vendor F1 84.9%.

Not planned: GPT-OSS Safeguard (20B, lowest recall in the table) and the
encoder-only single-category classifiers.

## Not tested, and why

- Image content. Cards carry file ids, not images; #263 is text only.
- Recall in languages other than those in the generated corpus, which is
  mostly English, Spanish, German and French.
- Prompt injection through card text. A handful of round-three cases, not a
  corpus.
- Throughput under concurrency. Publishing is one deck at a time.
