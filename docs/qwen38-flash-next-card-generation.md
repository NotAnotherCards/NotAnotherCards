# Research: Qwen3.8-Flash-Next for card generation on the GX10

Status: proposed, not yet run. Written 2026-08-27.

## Question

Can a 180B model serve any part of the flashcard path on one GX10, and if so
which part? Report v2 answered this for the 26B to 35B class. It did not
cover models that only fit by keeping part of their weights off the
accelerator.

Two sub-questions, with different answers expected:

1. Interactive generation. Almost certainly no, on latency. Worth measuring
   once so the number exists rather than being assumed.
2. Queued verification. Open. Report v2 found the local Qwen/MiniCheck pass
   caught 63 of the 164 issues the final adjudicator accepted, and named a
   stronger local judge as the gap. A 180B model is the obvious candidate to
   test against that gap.

## Why this model is testable at all

Qwen3.8-Flash-Next has 176.9B parameters, of which 51.2B are a single n-gram
/ PLE embedding table (`per_layer_token_embd.weight`, shape
[160, 320001536]). That tensor is gathered sparsely, about 16 rows per token,
and the rows are addressed from token ids before the gather runs. It can be
served from NVMe through the OS page cache instead of occupying unified
memory. llama.cpp does this with `-ot "per_layer_token_embd=CPU"` and mmap.

That leaves 125.7B compute parameters resident, roughly 77 GiB at
UD-Q4_K_XL.

## Hardware fit

Our measured ceiling is about 109.5 GiB CUDA-free. Resident weights at
UD-Q4_K_XL are about 77 GiB. The KV cache is about 24 KB per token, because
only 12 of the 48 blocks use full attention and those use 2 KV heads, so the
full 262,144-token window costs about 6 GiB. Total around 83 GiB, inside our
ceiling.

The vLLM NVFP4 path does not fit. The checkpoint is 135.3 GB, and the
published configuration runs 111 of 121 GiB with an 18.13 GiB KV pool. It is
the better configuration for prose (32.2 against 27.8 tok/s, 0.3 s time to
first token against 1 to 2 s), so this is a real loss, not a preference.

Smaller quants do not help. Q3_K_XL is 20 GB smaller and measured 24.0 tok/s
on prose against Q4_K_XL's 27.8. Card generation is novel short text, which
is the prose shape, so the smaller quant is slower on the workload we care
about. Q4_K_XL is the version to test.

## What to expect

A five-card set is roughly 300 generated tokens of novel text. At 27.8 tok/s
plus 1 to 2 s to first token, that predicts 12 to 13 seconds per set. Report
v2's default, `gemma4:26b-a4b-it-q4_K_M`, has a general median of 3.49 s.

Two effects will dominate any number we take:

- Thinking. Published measurements on this model show 86% of generated tokens
  being reasoning, and the same answer arriving in 15 s instead of 55 s with
  thinking off. Every run here must set
  `{"chat_template_kwargs": {"enable_thinking": false}}` and record that it
  did.
- Speculation shape. The model's headline speeds come from `ngram-mod`
  speculation, which drafts by copying repetition out of the prompt. It is
  worth 88.5 tok/s when reproducing a file with one change and nothing at all
  on novel text. Card generation gets no benefit from it. Any figure quoted
  from elsewhere without a task attached does not transfer to this workload.

So the expected result is a model that is 3 to 4 times slower than the
current default on the interactive path. The experiment is worth running for
the quality numbers and for the judge question, not in the hope of a fast
generator.

## Method

Reuse the v2 harness unchanged so the comparison holds.

1. Serve `unsloth/Qwen3.8-Flash-Next-GGUF` at UD-Q4_K_XL through llama.cpp
   with `-ot "per_layer_token_embd=CPU"` and mmap. Record load time, resident
   memory, page cache size, and free memory during serving.
2. Run the existing 50-set suite from `infra/gx10/results/2026-08-24/`
   (`driver.mjs`, `gen-lang.mjs`), thinking off.
3. Audit with `audit.mjs`, then adjudicate the escalated cards the same way,
   so the issue rate is comparable to the v2 table.
4. Report the v2 columns: format success, general median, language median,
   decode tok/s, major, minor, issue rate.
5. Separately, run the model as a judge over the 204 Fable-labelled cards and
   compare recall against the current Qwen/MiniCheck pass, which found 63 of 164.

## Harness changes to make first

Both come from the published methodology for this model and apply to our
existing suite regardless of the outcome here.

- Vary a token per repetition. Repeating an identical prompt lets a
  context-copying drafter draft from its own previous generation. The
  published inflation from not doing this was 60 to 169 tok/s. Our suite
  should confirm it does not repeat prompts verbatim across repetitions.
- Discard one warmup per task. The first request after any state change is
  markedly slower.

Also worth resolving: whether the Qwen 3.8 27B numbers in report v2 were
taken with thinking on. If they were, "slower and less accurate than Qwen
3.6" may be measuring the reasoning trace rather than the model.

## Deliverables

- A row in the report v2 results table, or an explicit note that the model
  was excluded from it and why.
- A judge comparison against the frozen 204-card recall set.
- A memory record: resident, page cache, and free memory during serving, so
  the 109.5 GiB ceiling question is settled with our own numbers rather than
  a third party's 121 GiB figure.

## Risks and open questions

- Our 109.5 GiB ceiling and the published 121 GiB usable figure disagree.
  Establish which conditions produce which before trusting any tight
  configuration.
- The recipe depends on two patches to inference engines
  (`canreuse-qwen4exp`, `rowband-ple-quant`). Read them before running them.
  The CUDA graph capture in the first one is what makes page-cache residency
  stop mattering, so it is not optional for reproducing the numbers.
- The source repository was created 2026-08-26 and is one week old at most.
  It corrects its own claims in place and marks one measurement as
  unphysical and unpublished, which is a good sign, but nothing in it has
  been independently reproduced. One inconsistency to ask about: its sources
  page says the NVFP4 checkpoint does not fit a single 128 GB Spark, while
  its measurements page reports serving that checkpoint.
- A 111 GB download and a multi-hour run. Not worth starting until the
  interactive question is accepted as closed on the predicted numbers.

## Sources

- Recipe, measurements, and negative results:
  https://github.com/0xBakeer/qwen38-flash-next-spark
- Weights: https://huggingface.co/unsloth/Qwen3.8-Flash-Next-GGUF
- Base model: https://huggingface.co/Qwen/Qwen3.8-Flash-Next
- Our baseline: `docs/model-report-v2.md`
