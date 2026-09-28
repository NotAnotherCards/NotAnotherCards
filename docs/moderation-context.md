# Individual-text publish moderation (#450)

## Current design

The fast classifier receives each original user-written string alone:
every textual word-note field, basic front/back, additional content, and
legacy card faces differing from their compiled templates. Media IDs and
language IDs are not prose. No field labels, language names or educational
framing are added to the classifier input. Whitespace is preserved; blank
strings are skipped. Exact strings are deduplicated across the entire deck.
Each opinion maps to all cards of all notes containing the text.

Only refused texts of at most 40 Unicode code points reach the default
model. The judge receives that text, other named fields of at most 40 code
points, and the server-resolved deck languages. Longer refused texts remain
refused without a judge call. Strict `confirm`/`warn` validation and the
existing policy remain in force. Every distinct containing-note context
must permit a downgrade; one permissive duplicate note cannot override a
refusal or error elsewhere. The audit retains the classifier and judge
opinions. Warning reasons are model-written text of 1–500 characters,
displayed directly by web, not necessarily classifier category names.

The pool defaults to 8, configurable with `MODERATION_CONCURRENCY` (1–8).
The shared deadline is 5 seconds plus 1 second per distinct text, capped at
240 seconds; each request is capped at 30 seconds. A judge cannot extend
the budget. Deadline exhaustion fails closed, including work still queued.
Reports and their independent per-card thorough checks are unchanged.

Unknown/uncompileable notes fall back to individual rendered card faces;
orphan cards are not omitted. Cardless notes get a controlled refusal.
Snapshot redaction still rejects malformed/non-object fields with HTTP 422
rather than publishing data whose media identifiers cannot safely be removed.
The extracted judge and shared HTTP helper remain separate from the worker
loop. `MODERATION_ALLOW_ALL=1` remains a test/demo-only bypass.

## Reproduction

Use the existing GX10 corpus `~/moderation-bench/corpus-200.jsonl`, copied
locally, without committing its text. The fixture exporter uses the real
compiler and snapshot builder. Corpus strings remain byte-for-byte intact
in the individual fields, including leading/trailing whitespace. The word
fixtures have `ejemplo`, `example`, `noun` and the corpus text as `example`;
they have no example translation and therefore compile to **two cards**.
Earlier documentation incorrectly said three.

```sh
pnpm --filter './packages/**' build
node decks/build.mjs decks/spanish-a1.txt > /tmp/spanish.json
pnpm --filter api exec tsx scripts/moderation-bench-inputs.ts corpus /tmp/corpus-200.jsonl > /tmp/basic.jsonl
pnpm --filter api exec tsx scripts/moderation-bench-inputs.ts word-corpus /tmp/corpus-200.jsonl > /tmp/word.jsonl
pnpm --filter api exec tsx scripts/moderation-bench-inputs.ts deck /tmp/spanish.json > /tmp/spanish-fields.jsonl
pnpm --filter api exec tsx scripts/moderation-bench-inputs.ts injection-control /tmp/corpus-200.jsonl > /tmp/control.jsonl
pnpm --filter api exec tsx scripts/moderation-bench-inputs.ts injection /tmp/corpus-200.jsonl > /tmp/injection.jsonl
```

Through a temporary tunnel to GX10's Ollama `/v1` endpoint, run each set as
one deck with the production service, including deduplication and deadline:

```sh
pnpm --filter api exec tsx scripts/moderation-text-bench.ts \
  --base http://127.0.0.1:14505/v1 --pool 8 \
  --corpus /tmp/word.jsonl --out /tmp/word-results.json
```

Repeat Spanish with pools 1, 4 and 8, sequentially to avoid contaminating
wall times. Model defaults are `qwen3guard-8b:latest` and
`gemma4:26b-a4b-it-q4_K_M`; temperature is zero. Results store IDs, grades,
field names and text SHA-256 values, never corpus/model text. The benchmark
observes actual HTTP replies without replacing the production decisions.
Its `errors` count is expanded audit rows, not unique failed HTTP requests.
Incomplete texts/notes must not be counted as safe.

The injection set appends ten different instruction attacks to the first
ten harmful-labelled corpus items, in file order. The control set has the
same fields without those instructions. These now run through the real
gate, not a forced-refusal judge. Long injected examples are never sent to
the judge; that restriction is not a guarantee for all short injections.

## Current GX10 results

Ollama 0.32.15, `OLLAMA_NUM_PARALLEL=2`, Qwen3Guard
`qwen3guard-8b:latest`, judge `gemma4:26b-a4b-it-q4_K_M`, temperature zero.
Runs were sequential; no serving settings were changed. The whole-deck
benchmarks used the production pool and deadline, not per-note resets.

Grades below are per corpus item, taking the highest individual-field grade.
For basic and word-note sets, SHA-256 matching also verified the classifier
grade of each original corpus string against the raw baseline: **no changed
item IDs**, not merely equal totals.

| Set                     | Safe / controversial / unsafe, harmful-labelled | Finally refused | Judge downgrade IDs      |
| ----------------------- | ----------------------------------------------- | --------------- | ------------------------ |
| Raw baseline            | 0 / 15 / 85                                     | 85              | none (no judge)          |
| Basic fields            | 0 / 15 / 85                                     | 85              | none                     |
| Word fields             | 0 / 15 / 85                                     | 84              | `unsafe-024` (`example`) |
| Injection controls (10) | 0 / 2 / 8                                       | 8               | none                     |
| Injected examples (10)  | 0 / 3 / 7                                       | 7               | none                     |

All 100 benign items remain safe in both full corpus sets. Basic fields
took 45.608 s (197 distinct texts, one judge call); word fields took
39.309 s (200 distinct texts, one judge call). Both completed without errors.
The word-note warning for `unsafe-024` is a new downgrade of a short
harmful-labelled example, not the previously accepted `unsafe-035`.
The latter now remains refused because its text exceeds 40 code points.

Injection controls took 3.013 s; attacks 3.158 s. Each had 13 distinct texts,
zero errors and zero judge calls. `unsafe-009` changed from unsafe to
controversial with the appended instruction, so fewer judge calls do not
establish classifier injection resistance. The appended examples are too
long to reach the judge under the new rule.

### Spanish A1: deadline requirement still blocked

513 notes, 1,539 rendered cards, **2,536 distinct texts**. All three runs
timed out and refused publication. Times are time-to-deadline, **not times
to finish screening the deck**:

| API pool | Wall time | Completed classifier texts | Unfinished texts |
| -------- | --------- | -------------------------- | ---------------- |
| 1        | 240.075 s | 994                        | 1,542            |
| 4        | 240.090 s | 1,572                      | 964              |
| 8        | 240.066 s | 1,569                      | 967              |

There were no judge calls or downgrades in these partial runs; unscreened
texts have no safety verdict. The shared GX10 Ollama service permits only
two parallel generations, while the API pool can queue more requests.
Changing/restarting that shared service requires coordination. No claim is
made that increasing its parallelism will meet the budget without measuring.

The <=240 s acceptance criterion is **not met**. The optional per-card second
pass was **not added**: no completed run leaves half the budget. The full
live publication acceptance test remains a blocker rather than being
weakened to accept a timeout. No completed whole-deck safety verdict exists
for Spanish under this revision.

### Authorized temporary serving-parallelism trial

The active server is Docker container `gx10-stack-ollama-1`; the systemd
Ollama unit is inactive. The container was independently verified to have
`OLLAMA_NUM_PARALLEL=2`, matching the earlier measurements. With approval,
a temporary Compose override raised it to 8 while keeping context length
8192, images and model versions unchanged. Both live runners showed `-np 8`.
Models were warmed before timing; API pools ran sequentially, 8 then 4 then 1.

| API pool, server parallelism 8 | Wall time | Completed texts | Unfinished |
| ------------------------------ | --------- | --------------- | ---------- |
| 1                              | 240.074 s | 961             | 1,575      |
| 4                              | 240.074 s | 1,908           | 628        |
| 8                              | 240.062 s | 2,278           | 258        |

All are deadline failures, not completed screening times. Pool 8 improved
completion from 1,569 to 2,278 texts but still missed the requirement. No
run left half the budget, so no second pass was added. These partial runs
cannot establish the safety outcome of the complete Spanish deck.

There were no judge downgrades. Pool 4 flagged `note-324`'s `pronunciation`
field (`ˈnegɾo`) and made one judge request without a recorded verdict; the
refusal remained. Server logs included a 30-second HTTP 500 during that run.
This is not evidence that the judge confirmed the finding. Pools 1 and 8
made no judge requests before their deadlines.

The original Compose configuration and parallelism 2 were restored after
the trial. The shared serving configuration was not permanently changed.
The 240-second acceptance criterion remains blocked; raising parallelism
to 8 alone did not solve it.

## Historical comparisons, not current acceptance results

For 100 harmful-labelled items, raw corpus input gave 0 safe / 15
controversial / 85 unsafe. The old per-rendered-card input on the same word
fixtures gave 2 / 32 / 66 after taking the highest card grade per note.
Whole-note fields without vocabulary framing gave 9 / 35 / 56; adding
the vocabulary line gave 12 / 36 / 52, then the judge reduced refusals to 50.
All 100 benign items stayed safe. This motivated individual-text screening.

The earlier basic-note judge downgrade of `unsafe-035` was accepted after
review, but does not authorize other regressions. Under the new length
restriction, long refusals cannot be downgraded at all.

Earlier forced-refusal injection probes downgraded 2/10 controls and 2/10
attacks, but with a different item (`unsafe-008`) becoming a warning. Equal
aggregate counts did not establish resistance. JSON delimiters alone are
not an enforceable model trust boundary.

## Regression checks

Unit tests cover exact field inputs, deduplication and fan-out, bounded
concurrency, the 40-code-point limit, exclusion of long context, conflicting
note contexts, failure/timeout/invalid-output refusals, orphan cards and
uncompileable notes. Sharing endpoint tests verify controlled 422s,
publication, persisted warnings and visibility using controlled replies.

Optional live tests use `MODERATION_LIVE_API_BASE`,
`MODERATION_LIVE_JUDGE_MODEL`, `MODERATION_LIVE_FAST_MODEL`, and an isolated
`TEST_DATABASE_URL`. The full Spanish publication test retains its 200
expectation: a failed timing benchmark is not permission to relax it.
