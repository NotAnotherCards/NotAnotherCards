# Model report: card generation on the GX10

Status: measured 2026-07-31 to 2026-08-01 on the GX10 (ollama 0.32.5). Rerun
any row with `infra/gx10/model-test.mts`. Model choices in
`infra/gx10/litellm-config.yaml` follow the recommendations at the end.

## What was measured

Each model generated flashcard sets for six topics (Spanish grammar, German
text comprehension, high school biology, French Revolution history,
JavaScript array methods, music intervals), three to five runs per topic,
with a fixed prompt requiring a JSON array of `{front, back}` cards. We
recorded format validity, latency, and factual errors.

The prompt, identical for every model and run except for the topic sentence:

> You generate flashcards for a spaced-repetition app. Create 5 flashcards
> for the topic "Spanish preterite tense for beginners". Reply with only a
> JSON array, each element {"front": string, "back": string}. Front is a
> question or prompt, back is the answer. Keep each side under 20 words.

The German topic replaces the middle sentence with "From the German text
below, create 4 comprehension flashcards in German for an A2 learner" plus
a three-sentence text about a baker (the full text is in the German samples
below and in `infra/gx10/model-test.mts`, which also carries all six topic
prompts for reruns).

Error counting: every set went through a two-stage review. mistral-small3.2
flags suspicious cards, then qwen3.6:35b in thinking mode re-judges each
flagged card individually (for the German topic it gets the source text,
without it the judge guesses). Counts are therefore judge-estimated, not
hand-verified. Spot checks say the judge is reliable but not perfect in both
directions; music theory is where both models and judges are weakest.

Thinking models appear twice: `+think` rows let the model reason before
answering (more tokens, more latency), plain rows disable it per request
(`think: false`).

## Results

| config | sets | format ok | median s | confirmed errors |
|---|---|---|---|---|
| qwen3.6:35b | 30 | 30/30 | 3.0 | 5 |
| qwen3.6:35b+think | 30 | 30/30 | 30.4 | 2 |
| qwen3-next:80b | 30 | 30/30 | 43.5 | 1* |
| mistral-small3.2 | 30 | 30/30 | 12.8 | 3 |
| nemotron3:33b | 18 | 17/18 | 2.2 | 3 |
| granite4.1:8b | 18 | 18/18 | 5.5 | 5 |
| lfm2.5 | 18 | 17/18 | 6.6 | 14 |
| qwythos-27b | 18 | 18/18 | 16.4 | 2 |
| qwythos-27b+think | 18 | 18/18 | 74.6 | 3 |
| qwythos-9b | 18 | 18/18 | 4.2 | 7 |
| qwythos-9b+think | 18 | 17/18 | 27.2 | 8 |
| fable-fusion-27b | 18 | 18/18 | 14.1 | 4 |
| fable-fusion-27b+think | 18 | 18/18 | 125.5 | 0 |

\* the 80b's one confirmed error ("conjugate hablar for él: habló") is
actually correct; the judge miscalled it. Its real count is 0 or 1.

A set has 4 or 5 cards, so 30 sets is roughly 140 cards. Rates, not
absolute counts, are what to compare across rows with different set counts.

## What the numbers say

**Architecture beats size on this box.** qwen3.6:35b and nemotron3:33b
generate at 74 to 76 tok/s because they are sparse MoE models (few active
parameters per token). The dense models (mistral 24B, gemma4 31B,
qwythos/fable 27B, qwen3.6:27b) all land at 12 to 16 tok/s, limited by the
GB10's unified memory bandwidth. A bigger dense model is strictly slower
here; a bigger MoE is not.

**Thinking is a latency-for-accuracy dial.** The same qwen3.6:35b goes from
5 errors at 3 s to 2 errors at 30 s. fable-fusion goes from 4 errors at
14 s to 0 errors at 125 s. Thinking pays in accuracy, always costs an order
of magnitude in latency, and belongs only where nobody is waiting.

**Small models are below the floor for this task.** lfm2.5 (2 GB) invented
German words ("kniet den Teig", "riekt") and produced a card answering its
own question with itself; qwythos-9b was better but still at 7 to 8 errors.
Both are fast and format-reliable, and both would teach users wrong facts.
Nothing below roughly 15 GB dense (or a good MoE) produced acceptable
accuracy.

**Errors cluster by topic.** Music intervals broke every model at least
once. History dates broke the small models. Spanish conjugation tables
produced memorize-a-mistake errors in every model that erred at all.
Generation from a provided text (the German topic) was the most reliable
mode across the board, and it is also the mode we can verify mechanically.

**The community models.** qwythos-27b (a Qwen3.5-27B fine-tune) is
genuinely mistral-class: 2 errors at 16 s. fable-fusion (an uncensored
qwen3.6-27b merge) needs thinking mode to be accurate and is then the
slowest config tested; without it, mid-field. Note both are community
uploads without an organization behind them, and fable-fusion has its
safety alignment deliberately removed, which sits oddly next to a moderation
module claim. Neither displaces an incumbent, qwythos-27b earns a config
line only if we want a second dense-quality option.

**deepseek-v4-flash at 2-bit** (added 2026-08-06). An 81 GB IQ2XXS GGUF
of DeepSeek-V4-Flash-0731 fits the box after all and got the six topics
plus harder probes: long German source texts with invented details,
reign and treaty dates over repeated runs, a worked Bayes example, all
against both qwens. Quality is a near-tie. Comprehension and derivation
survive the heavy quantization; what remains is occasional imprecision
on memorized specifics (one bad date run in five, one treaty date off by
a day) and small German case slips, where qwen3.6:35b made zero errors
throughout. Speed decides it: 18.5 tok/s, a quarter of the qwen MoE
rate, and loading the 81 GB evicts every other model on the box. The
optimized serving stacks don't rescue it. The EXL3/vLLM recipe (claims
34 to 39 tok/s) cannot initialize here: it demands 115 GiB free and the
GX10 exposes at most 109.5 GiB to CUDA even freshly rebooted with
everything stopped. DwarfStar 4's claimed 26 tok/s would still trail
the qwens. Recommendation unchanged.

## Sample cards

Spanish (topic prompt) and German (generate-from-text) sets per model, taken
verbatim from test runs. Judge for yourself; the error counts above are the
aggregate view.

All models got the byte-identical prompt, so the differences below are the
models themselves. Two sources: sampling randomness (generation is not
deterministic, the same model writes different cards each run, which is why
every row is 18+ sets) and instruction-tuning style (qwen writes single-fact
drills, mistral answers with form lists, nemotron likes true/false). The
prompt fixes the format but not the pedagogical style; if we want uniform
card style in the app, the generation prompt has to say so explicitly, e.g.
"one fact per card".

### qwen3.6:35b

**spanish**

- Conjugate 'hablar' (to speak) for 'yo' in preterite. — hablé
- Conjugate 'comer' (to eat) for 'tú' in preterite. — comiste
- Conjugate 'vivir' (to live) for 'ellos' in preterite. — vivieron
- What is the irregular preterite for 'ser/ir' for 'él'? — fue
- What is the irregular preterite for 'hacer' (to do) for 'yo'? — hice

**german**

- Um wie viel Uhr öffnet der Bäcker seine Backstube? — Er öffnet sie jeden Morgen um vier Uhr.
- Was macht der Bäcker, während die Stadt schläft? — Er knetet den Teig.
- Um wie viel Uhr duftet die Straße nach Brot? — Die ganze Straße duftet um sieben Uhr nach frischem Brot.
- Welche Aktivität erledigt der Bäcker in der frühen Vormittagszeit? — Er öffnet seine Backstube und beginnt mit dem Backen.

### qwen3.6:35b+think

**spanish**

- How do you conjugate regular -AR verbs in the preterite for 'yo'? — Add -é to the stem, e.g., hablar becomes hablé.
- What endings do regular -ER and -IR verbs take for 'yo' and 'tú'? — Yo: -í (comí). Tú: -iste (comiste).
- Which three verbs have a unique irregular preterite stem used for all persons? — Ser (fui), ir (fui), and ver (vi).
- Conjugate the verb 'hacer' in the preterite for 'ella'. — Ella hizo.
- Use the preterite for actions that are: — Completed in the past with a definite beginning or end.

**german**

- Wann öffnet der Bäcker seine Backstube? — Jeden Morgen um vier Uhr.
- Was macht der Bäcker, während die Stadt schläft? — Er knetet den Teig.
- Was duftet die ganze Straße um sieben Uhr? — Nach frischem Brot.
- Was knetet der Bäcker? — Den Teig.

### qwen3-next:80b

**spanish**

- What is the preterite tense used for? — Completed past actions with specific time.
- How do you say 'I ate' in Spanish preterite? — Comí.
- Conjugate 'hablar' for 'él'. — Habló.
- What is 'we were' in preterite (ser)? — Fuimos.
- How do you say 'they went' in preterite? — Fueron.

**german**

- Wann öffnet der Bäcker seine Backstube? — Jeden Morgen um vier Uhr.
- Was macht der Bäcker, während die Stadt schläft? — Er knetet den Teig.
- Wann duftet die Straße nach frischem Brot? — Um sieben Uhr.
- Nach was duftet die Straße um sieben Uhr? — Nach frischem Brot.

### mistral-small3.2

**spanish**

- How do you say 'I ate' in Spanish? — 'Yo comí'
- What's the preterite of 'hablar' (to speak)? — 'hablé', 'hablaste', 'habló'
- How do you say 'She ran' in Spanish? — 'Ella corrió'
- What's the preterite of 'vivir' (to live)? — 'viví', 'viviste', 'vivió'
- How do you say 'We saw' in Spanish? — 'Nosotros vimos'

**german**

- Wann öffnet der Bäcker seine Backstube? — Jeden Morgen um vier Uhr.
- Was macht der Bäcker mit dem Teig? — Er knetet den Teig.
- Wie spät ist es, wenn die Straße nach frischem Brot duftet? — Um sieben Uhr.
- Was schläft noch, während der Bäcker arbeitet? — Die Stadt schläft noch.

### nemotron3:33b

**spanish**

- What is the Spanish preterite tense used for? — Actions completed at a specific past time.
- Conjugate "hablar" (to speak) in the first‑person singular preterite. — hablé
- Which ending indicates "we" (nosotros) in the preterite of regular -ar verbs? — -amos
- True or false: The preterite can express ongoing past actions without a clear start/end. — False; it expresses completed actions.
- Give an example sentence using "comer" in the preterite, first‑person singular. — Comí pizza ayer.

**german**

- Um wie viel Uhr öffnet der Bäcker seine Backstube? — um vier Uhr
- Wann knetet der Bäcker den Teig? — während die Stadt noch schläft
- Was duftet die Straße um sieben Uhr? — nach frischem Brot
- Wo arbeitet der Bäcker? — in seiner Backstube

### granite4.1:8b

**spanish**

- How do you form the Spanish preterite of regular -ar verbs? — Remove '-ar' and add endings: -é, -aste, -ó, -amos, -asteis, -aron.
- What is the preterite of 'hablar' (to speak)? — 'Hablé', 'hablaste', 'habló', 'hablamos', 'hablasteis', 'hablaron'.
- Translate: 'I ate lunch.' to Spanish preterite. — Comí el almuerzo.
- What is the preterite of 'ser' (to be)? — 'Fui', 'fuiste', 'fue', 'fuimos', 'fuisteis', 'fueron'.
- How do you say 'We visited Madrid.' in Spanish preterite? — Visitamos Madrid.

**german**

- Wann öffnet der Bäcker seine Backstube? — Jeden Morgen um vier Uhr.
- Was macht der Bäcker mit dem Teig? — Er knetet den Teig.
- In welchem Zustand ist die Stadt, wenn der Bäcker arbeitet? — Die Stadt schläft noch.
- Um welche Uhrzeit duftet die Straße nach frischem Brot? — Um sieben Uhr.

### lfm2.5

**spanish**

- What is the preterite tense? — It describes a completed action at a specific time in the past.
- When do we use the preterite? — After an action is finished or has a clear endpoint.
- What does 'ayer' mean? — It means 'yesterday' in Spanish.
- How do you form the preterite of 'hablar'? — Ir + past participle: hablé, hiciste, etc.
- What is the difference between preterite and imperfect? — Preterite = single completed event; imperfect = ongoing or habitual past.

**german**

- Um welchen Zeitpunkt öffnet der Bäcker seine Backstube? — Jeden Morgen um vier Uhr.
- Was macht er, während die Stadt schläft? — Er kniet den Teig.
- Um welchen Zeitpunkt riecht die Straße nach frischem Brot? — Um sieben Uhr.
- Was tut der Bäcker mit dem Teig? — Er kniet den Teig.

### qwythos-27b

**spanish**

- What are the regular -AR preterite endings? — -é, -aste, -ó, -amos, -asteis, -aron
- Conjugate 'hablar' (to speak) in the preterite for 'yo'. — hablé
- What are the regular -ER/-IR preterite endings? — -í, -iste, -ió, -imos, -isteis, -ieron
- Translate: 'I ate pizza yesterday.' (comer) — Comí pizza ayer.
- How do you form the preterite of a regular -ER verb like 'beber'? — Replace -er with -í, -iste, -ió, etc. (bebí)

**german**

- Wann öffnet der Bäcker seine Backstube? — Um vier Uhr jeden Morgen.
- Was macht der Bäcker, während die Stadt noch schläft? — Er knetet den Teig.
- Wie duftet es um sieben Uhr auf der Straße? — Nach frischem Brot.
- Wer öffnet die Backstube um vier Uhr? — Der Bäcker.

### fable-fusion-27b

**spanish**

- How do you conjugate 'hablar' (to speak) for 'yo' in preterite? — Hablé
- What are the endings for regular -ar verbs in preterite? — -é, -aste, -ó, -amos, -aron
- Conjugate 'comer' (to eat) for 'ella' in preterite. — Comió
- Translate: 'I walked to the park yesterday.' — Caminé al parque ayer.
- What is the stem change for 'ir' and 'ser' in preterite? — Same irregular forms: fui, fuiste, fue...

**german**

- Um wie viel Uhr öffnet der Bäcker seine Backstube? — Er öffnet sie jeden Morgen um vier Uhr.
- Was macht der Bäcker, während die Stadt noch schläft? — Er knetet den Teig für das Brot.
- Um wie viel Uhr duftet die ganze Straße nach frischem Brot? — Die Straße duftet um sieben Uhr nach frischem Brot.
- Wann ist der Bäcker schon wach und arbeitet? — Er ist schon früh am Morgen, wenn die Stadt noch schläft, aktiv.

### fable-fusion-27b+think

**spanish**

- What does the preterite tense indicate? — Completed actions in the past with a specific start and end time.
- Conjugate 'hablar' for 'yo' in the preterite. — Hablé (I spoke).
- What are the endings for regular -ER/-IR verbs? — -í, -iste, -ió, -imos, -ieron.
- How do you say 'I went' or 'I was' in Spanish? — Fui.
- Translate: 'She ate an apple yesterday.' — Ella comió una manzana ayer.

**german**

- Wann öffnet der Bäcker seine Backstube jeden Morgen? — Er öffnet sie um vier Uhr.
- Was macht er, während die Stadt noch schläft? — Er knetet den Teig.
- Wann duftet die ganze Straße nach Brot? — Um sieben Uhr.
- Nach was duftet die Straße um sieben Uhr? — Sie duftet nach frischem Brot.


## Verification

The generation numbers above justify a verification layer: even the best
interactive config leaves a few percent of cards wrong. Tested checkers:

- **bespoke-minicheck:7b** (grounding, "is this claim supported by this
  document"): ran over all 188 German cards from every model. 3 flags, all
  genuine (lfm2.5's self-answering card and invented time, one borderline
  inference). Near-zero false positives, seconds per card. This is the
  gate for generate-from-text flows, exposed as `fact-check` in the gateway.
- **qwen3.6:35b thinking as judge** (open-domain facts): on a benchmark of
  four planted errors among six correct cards, per-card answer-then-compare
  caught 4/4 with zero false positives. Around 30 s per card, so queue-only.
  Same model as the `qwen` gateway entry, called with thinking enabled.
- **mistral-small3.2 as judge**: 3/4 with one false positive at about 5 s
  per card. Usable as a cheap screen where a miss is acceptable.
- **granite4.1-guardian:8b** (moderation): ran over 1,344 benign generated
  cards in its harm mode, flagged 0. Good specificity on exactly our
  content; sensitivity on genuinely harmful content was not measured.
  Exposed as `moderation` in the gateway.

One negative result: set-level screening (judging 5 cards in one prompt)
flagged 105 of 106 sets and carried no filtering value. Verification must
be per card.

### Verifier bake-off

We also tested purpose-built evaluator models against the general-model
setup above, same benchmarks.

Judges, on the 10-card planted-error benchmark (4 bad, 6 clean):

| judge | caught | false positives | total time |
|---|---|---|---|
| qwen3.6:35b think (baseline) | 4/4 | 0 | ~3 min |
| mistral-small3.2 (baseline) | 3/4 | 1 | ~1 min |
| prometheus-7b | 3/4 | 2 | 31 s |
| selene-mini (8B) | 2/4 | 2 | 17 s |
| glider (3.8B) | 0/4 | 0 | 10 s |

None of the purpose-trained judges beats the general models. glider judged
everything OK. The pattern matches generation: judging Spanish grammar
requires knowing Spanish grammar, and 4-8B models don't, however
judge-shaped their training. Caveat: prometheus and selene are built for
rubric-style evaluation prompts and got our simpler verdict prompt, and the
prometheus GGUF is an older version.

Grounding checkers, all 188 German cards:

| checker | flags | assessment |
|---|---|---|
| bespoke-minicheck:7b | 3 | all genuine |
| lynx-8b | 5 | 3 genuine, 2 defensible cards flagged |
| HHEM (Vectara, CPU classifier) | 10 | genuine inferences plus several German paraphrase false positives |

minicheck stays the pick. HHEM is fast and would likely do better on
English sources; on German it penalizes paraphrase. Lynx is a reasonable
second opinion. Unlike the others, HHEM is not an ollama model: it is a
small classifier run via transformers on CPU (pin `transformers<5`, its
custom model code predates the 5.x API).

Moderation, benign false-positive rate on generated cards:

| model | flagged |
|---|---|
| granite4.1-guardian:8b | 0 / 1,344 |
| shieldgemma | 0 / 300 |
| llama-guard3 | 0 / 300 |
| qwen3guard-8b | 0 / 300 |

All four are silent on benign content. guardian stays because it is already
integrated and doubles as a groundedness checker; there is no measured
reason to switch. Sensitivity on actually harmful content remains untested
for all of them.

## Recommendations

- **Interactive generation** (streaming preview): `qwen` with thinking off.
  3 s, clean format, best speed-accuracy trade.
- **Queued generation** (deck builder jobs): `qwen-next-80b` for best
  accuracy, or `mistral-small` when 13 s beats 44 s. Verification absorbs
  the remaining errors either way.
- **Verification**: minicheck for anything with a source text; qwen with
  thinking as the open-domain judge inside the queue; regenerate flagged
  cards rather than trusting judge corrections (judges err too).
- **Embeddings**: bge-m3, already serving as `embeddings`.
- Raise `OLLAMA_NUM_PARALLEL` past 2 only if gateway metrics show queueing.

## Content moderation AI: a possibility, not a plan

The subject offers "Content moderation AI (auto moderation, auto deletion,
auto warning)" as a Minor (1 point). What this report shows is feasibility:
guardian screens content with zero false alarms on 1,344 benign cards, and
the moderation call is one more job type on the queue we are building
anyway (#79). What it would still take: storing verdicts, warn/hide states
in the UI, an admin review list, and ideally deck sharing, since moderating
content only its author sees is a weak story. Whether the point is worth
claiming is a team decision; nothing in the current plan depends on it
either way.

## Hosted reference models (2026-08-07)

To place the local models, the same suite (six standard topics plus the
hard set: reign dates five runs, treaty dates, oxidation states, two
German source texts, the base-rate derivation) ran against hosted models
through the nano-gpt aggregator. These are reference points and
fallback candidates, not servable options; the point was a quality
ceiling, a check on our quantizations, and real per-task prices.

| model | suite | errors | tokens in+out | cost |
| --- | --- | --- | --- | --- |
| Qwen3.6-35B-A3B (hosted twin) | 16/16 | 0 | 2.3k + 4.3k | $0.004 |
| deepseek-v4-flash-0731 (full) | 16/16 | 1 | 2.2k + 3.8k | $0.001 |
| qwen3.8-max-preview | 16/16 | 0 | 3.1k + 19.7k | $0.103 |
| claude-sonnet-5 | 16/16 | 0 | 3.7k + 6.9k | $0.076 |
| gpt-5.6-sol | 16/16 | 0 | 2.1k + 5.2k | $0.168 |
| gemini-3.1-pro-preview | 16/16 | 0 | 2.1k + 19.3k | $0.236 |
| kimi-k3 | 16/16 | 0 | 3.8k + 14.6k | $0.207 |
| glm-5-turbo | 16/16 | 0 | 2.2k + 19.8k | $0.082 |

Whole campaign: about 115k tokens, $0.88. Prices are nano-gpt's listed
per-million rates at run time.

What it says:

**The suite has a ceiling and the frontier is at it.** Every hosted
model passed everything; the only failure anywhere is deepseek's Campo
Formio date, wrong by one day at full precision exactly as in our 2-bit
copy, which settles that error as the model's, not the quantization's.
The 2-bit emperors outlier from the addendum above did not recur at
full precision, consistent with sampling variance.

**Our local quantizations cost nothing measurable.** Hosted
full-precision Qwen3.6-35B and our ollama quant produced the same
result: zero errors. The gateway's champion is at frontier level on
this workload, at local prices.

**Frontier dollars buy garnish, not correctness.** qwen3.8-max and
gpt-5.6 volunteered day-exact reign dates (19 August AD 14, 9 June
AD 68, all verified correct) where every other model answered in
years. Real, visible, and irrelevant for card generation.

**Thinking is the cost driver.** The always-thinking models (gemini,
qwen3.8-max, kimi, glm) burned 3 to 5 times the completion tokens of
the direct answerers for identical accuracy. For this workload,
reasoning mode is a tax.

**Reliability footnote.** One glm request stalled long enough to trip
the client's header timeout and succeeded on retry; hosted fallback
plumbing should stream or carry generous timeouts.

Operationally: card generation on the hosted Qwen3.6 twin costs about
$0.0002 per five-card set (thousands of generations per dollar), which
makes it the designated gateway fallback; the frontier models stay
un-wired until a task can name what their premium buys. qwen3.8's
hosted preview suggests next week's open-weights row will be worth
adding.

## DFlash speculative decoding (2026-08-07)

The AEON-7 org publishes prebuilt vLLM containers for the DGX Spark
(sm_121a) pairing an NVFP4 quant of Qwen3.6-35B-A3B with DFlash, a
small drafter model whose proposed tokens the main model verifies in
batches. Speculative decoding trades a little extra memory for wall
clock: same weights, same outputs in expectation, faster sampling.

Measured beside the live ollama gateway (`--gpu-memory-utilization
0.40`, 32k context, the gateway stayed responsive throughout):

| serving | gen tok/s | suite + hard set | content errors |
| --- | --- | --- | --- |
| vLLM + DFlash (NVFP4) | 101–148 | 16/16 parse | 0 |
| ollama gateway (our q4) | 74–76 | 30/30 parse | 5 (see appendix) |

The two rows are different task counts and quants, so the error
column is not a like-for-like comparison; the speed column is the
finding. Every hard-set answer was checked by hand: the five
Napoleonic treaty dates to the day (including Campo Formio as 17
October 1797, which deepseek got wrong at full precision), the
Julio-Claudian reign dates, both German source texts, the ion colors,
and the base-rate derivation with exact arithmetic (0.009/0.0981 ≈
9.2%).

Caveats. The published build is a community "heretic" (abliterated)
variant, the only DFlash pairing available; on this workload the
surgery cost nothing measurable, but it is not an artifact we would
serve. It also needs `--reasoning-parser qwen3`: without the flag the
model's thinking floods the content channel and every parse fails,
which our first run reproduced.

What this changes: nothing today (the gateway stays ollama, and 74
tok/s is not our bottleneck), but it establishes that a vLLM lane
would roughly double generation speed on the same box while
coexisting with production. Worth revisiting when qwen3.8 lands, if
AEON-7 ships a build for it.

## Not tested locally, and why

- **Frontier-scale open models** (glm, kimi-k3): don't fit 128 GB
  unified memory, or would monopolize it. Not *served* locally, but no
  longer untested: hosted results for kimi-k3, glm-5-turbo, and
  deepseek-v4-flash are in the hosted reference section above.
- **qwen3.5:122b** (81 GB): would fit alone; skipped because 80b already
  hits ceiling accuracy and the box stays multi-model.
- **EuroLLM / Teuken** (EU multilingual): candidates if language-deck
  quality in less common languages becomes a complaint.
- **medgemma**: domain specialist, only relevant for medical decks.
- Newer models land continuously; adding one is `ollama pull` plus a line in
  litellm-config.yaml plus a `model-test.mts` run. Keep this report honest by
  appending rows, not by trusting vibes.

## Appendix: every confirmed error, reviewed

All 57 judge-confirmed errors, with a manual review of each. "Disputed"
means the card looks correct on inspection and the judge probably
false-confirmed; disputed entries are counted in the table above, so treat
row counts as upper bounds. The clusters are more informative than the
total: conjugation tables, historical dates, and music intervals is where
models fabricate.

### qwen3.6:35b (5)
- "conjugate hablar for yo" => "Hablaré" — future tense, not preterite (hablé).
- "Sept 5, 1793 event" => "Law of Suspects" — that law came Sept 17; Sept 5 is terror declared "the order of the day".
- "On what date did Louis XVI execute Marie Antoinette?" => Oct 16, 1793 — the date is right but the front is wrong: Louis XVI was executed nine months before her.
- "Minor vs Major Third" => "Major (5 semitones vs 4)" — it is 4 vs 3.
- German: "beginnt mit dem Backen" — the text never says he starts baking (grounding drift).

### qwen3.6:35b+think (2)
- "balanced chemical equation" => prose description — front demands an equation, back gives none.
- "dar and ver: both use written accents" — di, dio, vi, vio carry no accents.

### qwen3-next:80b (1, disputed)
- "conjugate hablar for él" => "Habló." — correct; judge miscall. Real count 0.

### mistral-small3.2 (3)
- "What interval sounds like Sol-Do?" => "descending perfect fifth" — defensible (G down to C); disputed.
- "same as a perfect fourth but higher" => "perfect fifth" — the front is not a meaningful question; fair kill.
- "reduce arguments" => mixes reduce's arguments with the callback's — conflated.

### nemotron3:33b (3)
- "smallest interval on a piano" => "Octave" — it is the semitone.
- "-er verbs, third person singular" => "-é (comer → comí)" — both wrong for él (comió).
- "method that returns true/false" => filter explanation — front ambiguous, back true of filter; disputed.

### granite4.1:8b (5)
- "-ar preterite endings" => "aba, abas, ..." — those are imperfect endings.
- "She ate lunch" => "Comió al almuerzo" — should be "el almuerzo" (or almorzó).
- "reactants of photosynthesis" => includes sunlight — energy input, not a reactant; strict but standard.
- "Robespierre came to power July 27, 1794" — that is 9 Thermidor, his fall.
- "octave = seven scale steps" — arguably correct counting; disputed.

### lfm2.5 (14)
- Five German cards: "kniet den Teig" three times (kneels, not kneads), one card answering its own question with itself, one placing kneading at seven o'clock (fabricated).
- "Which year did Louis XVI and Marie Antoinette die" => "January 21, 1793" — answers a date for a year question, and she died in October.
- Four music cards, all garbled ("perfect fifth: first to fourth note", "D major is a whole step above C", ...).
- "reduce returns ... default is initial value, often 0" — not a coherent statement of reduce.
- Three Spanish cards including "hablar: Ir + past participle" — nonsense.

### qwythos-27b (2)
- "major third: four semitones (whole + whole + half)" — the parenthetical sums to five.
- "perfect fifth above C: G (the seventh letter from C)" — G is the fifth letter from C.

### qwythos-27b+think (3)
- Two Reign-of-Terror cards with contradictory start dates, one tying it to Robespierre joining the Committee on June 10, 1793 (he joined in July; the Terror is usually dated from September).
- "How do stems change in the preterite" => an answer about accent placement — describes endings, not stem changes.

### qwythos-9b (7)
- "end of the Revolution / Napoleon's first coronation" => "November 2, 1805 (Battle of Trafalgar)" — Trafalgar was Oct 21, 1805 and is neither.
- "Who was proclaimed King in 1793" => "Louis XVI (after his execution)" — self-refuting.
- "Flight to Varennes: June 20, 1791" — correct; disputed.
- "treaty ending the Napoleonic Wars, April 1815" => "Treaty of Paris (April 30, 1815)" — wrong war-ending treaty and date.
- "major third" => "a fourth note in the scale; sounds happy" — not a definition.
- "you went (tú)" => "Fui" — that is yo; tú is fuiste.
- "leer for él/ella" => "Leió" — leyó.

### qwythos-9b+think (8)
- "reactants of photosynthesis" => includes sunlight — same strict flag as granite.
- German: "Um wie viele Uhr riecht die Straße?" => "Uhr sieben." — broken German on both sides.
- "which note pairs form a third" => "C-E major, C-Eb minor" — correct; disputed.
- "interval spanning seven scale steps" => "perfect fifth" — seven scale steps is an octave.
- "reduce with initial value" => accumulator description — correct; disputed.
- "convert string numbers with map" — implies map(parseInt), the classic trap that yields [1, NaN, NaN]; ambiguous.
- "irregular preterite yo verbs" => vague list mixing categories.
- "can preterite express ongoing actions" => "Yes, with context: 'Estaba leyendo'" — estaba leyendo is imperfect, contradicting the answer.

### fable-fusion-27b (4)
- "reactants of photosynthesis" => includes light energy — same strict flag.
- "how many whole steps make an octave" => "six whole steps plus two half steps" — six whole steps alone are the octave; as written it sums to 14 semitones.
- "conjugate hablar for yo" => "Hablé" — correct; disputed.
- "-AR ending for él/ella" => "-ó" — correct; disputed.

fable-fusion-27b's real count is therefore closer to 2, and the disputed
entries across all models (8 of 57) are exactly why the pipeline
recommendation says regenerate flagged cards instead of trusting judge
verdicts: the judge is a filter with noise in both directions, not an
oracle.
