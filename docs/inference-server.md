# Inference server: Ollama vs vLLM

Status: Ollama for now, mainly because changing models is easier. Can be
swapped to vLLM later; triggers at the end.

The GX10 serves models through LiteLLM (see [deployment.md](deployment.md)).
Expected load: the api's queue worker sending one generation at a time, an
occasional streaming preview, and teammates experimenting. Both servers speak
an OpenAI-compatible API, so LiteLLM hides the choice from every client.
Swapping later is a config change, not a code change.

## Ollama

For it:

- Runs many models side by side, loading and unloading on demand. Trying a
  model is `ollama pull`, so "new model as a PR" costs one line in
  litellm-config.yaml.
- Serves quantized GGUF weights (4-bit by default), so larger models fit in
  memory and several can stay resident.
- Already installed on the box with our first models pulled.
- Nothing to configure or babysit.

Against it: llama.cpp handles parallel requests poorly compared to vLLM.
Total throughput under concurrent load is a fraction of what the hardware
could do. Quantized weights also cost some output quality versus fp16.

## vLLM

For it:

- Continuous batching and PagedAttention: many concurrent requests share GPU
  passes, giving several times the total tokens/sec under parallel load.
- Serves fp16/fp8 weights, so best available output quality from a given
  model.
- Production serving features: prefix caching, guided decoding for strict
  JSON output, request scheduling, detailed metrics.
- NVIDIA publishes an optimized vLLM container for GB10 hardware.

Against it: one model per running instance, so swapping models means
restarting the server. Memory is reserved up front. More moving parts to
operate.

## Why Ollama for now

Our load profile uses none of vLLM's strengths and all of Ollama's. One
worker request at a time never triggers batching, while teammates trying
models is an explicit goal of the box and is where Ollama shines. Since
LiteLLM sits in front, this is not a one-way door: moving a model to vLLM
later changes a config line, not client code.

## Revisit when

- The streaming preview feels slow with several concurrent users.
- Generation wants strict JSON schema output (guided decoding) and
  prompt-side workarounds fall short.
- We want a quality comparison against fp16 serving of the same model.

Any of these: run NVIDIA's vLLM container next to Ollama, point a second
model name at it in litellm-config.yaml, compare, then decide.

## Image generation

Card image generation runs as its own service next to Ollama, sharing the
GPU. The model is SANA-Sprint (tried it, works well for us): 1-4 step
generation, small enough that memory and GPU contention with text models is
minor, fast enough for interactive use.

Serving: a small diffusers-based service with an OpenAI-style images
endpoint, bound to the tailscale interface like everything else. Whether it
goes behind LiteLLM or the api worker calls it directly is decided when the
first image feature ticket exists.

Out of scope for the gateway ticket (#76); text first. Depends on a
files/upload story before images can land on cards.
