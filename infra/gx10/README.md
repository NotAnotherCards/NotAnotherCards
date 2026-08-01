# GX10 AI stack

Everything the GX10 serves, as one compose file: Ollama (inference),
LiteLLM (gateway on :4000, the only thing clients talk to), a small
postgres for LiteLLM's keys, and two metrics exporters. Background and
tradeoffs: [docs/inference-server.md](../../docs/inference-server.md),
topology in [docs/deployment.md](../../docs/deployment.md).

Convention: our own code gets Dockerfiles, third-party software runs
official images plus config. This whole stack is third-party, so there
are no Dockerfiles here — config comes in via compose (env vars, mounted
litellm-config.yaml, volumes). The app bundle (#73) is our code, so it
does get Dockerfiles.

## Using it (teammates)

The gateway is public at `https://ai.dustyway.org`. You need a personal
key (ask dustyway), then it is an ordinary OpenAI-compatible API:

```sh
curl https://ai.dustyway.org/v1/chat/completions \
  -H "Authorization: Bearer $YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "mistral-small", "messages": [{"role": "user", "content": "hi"}]}'
```

Any OpenAI client works: set base URL and key. Keys have rate limits; if
you hit them, ask. The public URL is the VPS's nginx proxying to the box
over the tailnet (issue #85); on the tailnet,
`http://<gx10-tailnet-ip>:4000` works directly.

### After you have your key

Quickest way to see it work (no setup, from the repo):

```sh
node infra/gx10/model-test.ts qwen --nothink --topic programming --key <your key>
```

For app code, TypeScript, generating cards the way the app will:

```ts
import OpenAI from "openai";
import type { ChatCompletionCreateParamsNonStreaming } from "openai/resources/chat/completions";

// gateway extension: qwen models accept think to toggle reasoning mode
type GatewayChatParams = ChatCompletionCreateParamsNonStreaming & {
  think?: boolean;
};

interface Card {
  front: string;
  back: string;
}

const client = new OpenAI({
  baseURL: "https://ai.dustyway.org",
  apiKey: "sk-...",
});

const params: GatewayChatParams = {
  model: "qwen",
  think: false, // ~3 s; leave thinking on for fewer factual errors at ~30 s
  messages: [{
    role: "user",
    content:
      'You generate flashcards for a spaced-repetition app. Create 5 flashcards ' +
      'for the topic "JavaScript array methods (map, filter, reduce)". ' +
      'Reply with only a JSON array, each element {"front": string, "back": string}. ' +
      "Front is a question or prompt, back is the answer. Keep each side under 20 words.",
  }],
};

const r = await client.chat.completions.create(params);
const content = r.choices[0].message.content!;
const cards: Card[] = JSON.parse(
  content.slice(content.indexOf("["), content.lastIndexOf("]") + 1),
);
console.log(cards);
```

The prompt and the slice-parse are the benchmarked ones from
[model-test.ts](model-test.ts); they held a 106/108 valid-JSON rate
across models.

Which model for what (measured, see
[docs/model-report.md](../../docs/model-report.md)):

| model | use it for | notes |
|---|---|---|
| `qwen` | default chat and generation | fast with `think: false`; thinking mode is slower, more accurate, and doubles as our reviewer |
| `qwen-next-80b` | best accuracy, no hurry | ~45 s per answer |
| `mistral-small` | second opinion, dense-model style | |
| `fact-check` | "is this claim supported by this text" | prompt `Document: ...\nClaim: ...`, answers yes/no |
| `moderation` | content screening | granite guardian risk prompts |
| `embeddings` | vectors (bge-m3) | embeddings API, not chat |

Good to know:

- Running the snippet standalone needs an ESM context: `"type": "module"`
  in package.json (or name the file `.mts`), plus `pnpm add openai`.
- `think: false` matters: qwen without it reasons for ~30 s before
  answering.
- Streaming works (`stream: true`), the proxy passes tokens through.
- 429 means your rate limit (60/min). A slow response usually means the
  GPU is busy, and the first request after idle loads the model, which
  can take a minute.
- The box lives in a flat: no SLA. If it is down, it comes back.
- Benchmark a model yourself:
  `node infra/gx10/model-test.ts <model> --key <your key>`.

Available models are the `model_name` entries in
[litellm-config.yaml](litellm-config.yaml).

### Trying a new model

1. `ssh gx10 && ollama pull <model>` — the ollama CLI on the box talks to
   the containerized daemon, `ollama run <model>` works as usual.
2. To offer it through the gateway: add a `model_list` entry in
   litellm-config.yaml and open a PR.

Bigger experiments: the GPU is shared with production generation. The
production model stays loaded; announce long or memory-hungry runs in
Slack first.

## Running it (box setup)

Rebuild from scratch:

1. Install Ollama natively is NOT needed — only the CLI is useful
   (`curl -fsSL https://ollama.com/install.sh | sh` installs both; the
   native service gets disabled in step 3).
2. `git clone` the repo, `cd infra/gx10`, copy `.env.example` to `.env`
   and fill it in.
3. Free the port and the supervision: `sudo systemctl disable --now ollama`.
4. `docker compose up -d`.
5. Mint keys (see below), share the tailscale node with teammates.

Model files live in `/usr/share/ollama/.ollama` on the host (bind-mounted
into the container), so models survive rebuilds. The container writes new
models as root; if you ever revert to the native service, `chown -R
ollama: /usr/share/ollama/.ollama` first.

### Keys

LiteLLM stores virtual keys in its postgres. Mint one per teammate plus
one for the production worker. On the box, from `~/gx10-stack`:

```sh
NAME=daniel   # first name of the key holder
KEY=$(grep MASTER .env | cut -d= -f2)
curl -s http://100.64.0.1:4000/key/generate \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d "{\"key_alias\": \"$NAME\", \"rpm_limit\": 60}" \
  | jq -r .key > "key-$NAME.txt"
chmod 600 "key-$NAME.txt"
```

Conventions:

- One key per person, `key_alias` = first name, saved to
  `~/gx10-stack/key-<name>.txt` and handed over via DM, never committed
  or pasted into issues.
- Teammates get `rpm_limit: 60`. That is more than the GPU can serve
  anyway; the limit is not a throughput budget, it is a backstop that
  stops a runaway script after a minute instead of never. The production
  worker gets `"key_alias": "production-worker",
  "max_parallel_requests": 2` to protect the single GPU.
- Keys do not expire; they are valid until revoked. For a deliberately
  short-lived key (demo day), mint it with `"duration": "30d"`.
- List keys: `curl -s http://100.64.0.1:4000/key/list -H "Authorization:
  Bearer $KEY"`. Revoke one: POST its key to `/key/delete`. Losing a key
  file is no incident, revoke and re-mint.
- When handing a key over, point the person at "After you have your key"
  above.
- The master key is admin-only; never hand it out or put it in an app.

### Ops notes

- Ports: LiteLLM (:4000) and the exporters (:9100, :9400) bind to the
  tailscale IP only. Ollama (:11434) binds to localhost only — clients
  must go through LiteLLM, never around it.
- Docker must start after tailscaled, or the tailscale-IP port bindings
  fail. If containers are down after a reboot, `docker compose up -d`
  again.
- Daemon logs: `docker compose logs ollama` (not journalctl — the native
  service is disabled).
- `OLLAMA_NUM_PARALLEL=2` in the compose: raise it if LiteLLM metrics
  show requests queueing while the GPU has headroom.
