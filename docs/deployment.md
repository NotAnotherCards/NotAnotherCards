# Deployment and AI infrastructure plan

Status: proposal, to be discussed.

The subject sets one hard rule that shapes everything here: deployment must use
containers and run with a single command (III.2, rejection-level). Evaluation
happens on a school machine, not on our servers. So the compose file is the
canonical deployment. Our live server just runs that same compose continuously,
and the AI box is an external backend behind a config value.

## Topology

```
users ── HTTPS ──> VPS (public)                     GX10 (home box, tailnet only)
                   ├─ nginx + certbot               ├─ LiteLLM proxy :4000
                   ├─ web (static build)            ├─ inference server (Ollama or vLLM)
                   ├─ api (NestJS)                  │    bound to tailscale interface
                   ├─ postgres ── tailscale ───────>├─ node_exporter + DCGM exporter
                   ├─ monitoring compose:           └─ tailscaled
                   │    prometheus + grafana
                   └─ node_exporter
```

- The VPS is reachable from the internet over HTTPS only.
- The GX10 is an [ASUS Ascent GX10](https://www.asus.com/networking-iot-servers/desktop-ai-supercomputer/ultra-small-ai-supercomputers/asus-ascent-gx10/techspec/):
  NVIDIA GB10 (Blackwell) with 1 PFLOP tensor performance, 20-core Arm CPU,
  128 GB unified memory shared between CPU and GPU, 4 TB NVMe, running NVIDIA
  DGX OS. It has no open ports and is reachable only inside the tailnet
  ([what is Tailscale](https://tailscale.com/docs/concepts/what-is-tailscale)).
  Tailscale traffic is WireGuard-encrypted, which satisfies the subject's
  HTTPS rule for backend connections; traffic inside the compose network is
  allowed to be plain (III.3).
- The api never talks to the GX10 during a user request, see "AI request flow".

## One compose, three contexts

The same `docker-compose.yml` runs in three places:

1. **Evaluation / any dev machine**: `docker compose up` starts web, api,
   and postgres. The AI endpoint is whatever
   `AI_API_BASE` points to. If it points nowhere, generation jobs queue and the
   UI shows them as waiting; nothing errors. The compose must pass this test
   with no tailnet at all, since "runs with a single command" is
   rejection-level.

   For the live AI demo during evaluation, the plan is Tailscale on the eval
   machine (userspace mode, no root needed; falls back to relaying over 443,
   so campus firewalls are not a problem) with `AI_API_BASE` pointing at the
   GX10. (The GPU dashboard is visible either way — Grafana is a public
   URL.) Running a model on the eval machine itself is not an option, so
   plan B for the box
   being unreachable on eval day is pointing `AI_API_BASE` at a hosted
   OpenAI-compatible provider instead; costs cents for a demo and needs no
   code change. Without any endpoint the app still runs and shows jobs as
   queued, which is compliant but not much of a demo.

2. **The VPS**: same compose, plus nginx/certbot, `AI_API_BASE` pointing at the
   GX10 through the tailnet.
3. **A teammate's machine during AI work**: same compose, `AI_API_BASE`
   pointing at the GX10 with a personal key (see "Access").

## Deploys

- GitHub Actions deploys on merge to main (`.github/workflows/deploy.yml`): SSH with a deploy key and fingerprint verification to a restricted `deploy` user on the VPS, executing `docker compose -f docker-compose.yml -f docker-compose.production.yml up -d --build --wait`. Merging a PR is deploying; reverting a PR is rolling back.
- Compose files (`docker-compose.yml`, `docker-compose.production.yml`), Nginx config (`infra/vps/app.notanothercards.com.conf`), and reproducible setup guide (`infra/vps/README.md`) live in the repo. The setup is fully reproducible on a fresh VPS from the repo alone.
- Production env vars are documented in `.env.example` files, values stay on the server (subject III.3).

## The AI backend

The GX10 runs an inference server with LiteLLM in front. LiteLLM gives us:

- **One OpenAI-compatible URL** for everything. Clients never know or care
  what serves the model. Swapping models, adding a second one, or pointing a
  model name at a cloud provider is a config change in the repo, not a code
  change.
- **Keys with limits.** Each teammate gets a key with rate and token budgets,
  the production worker gets its own with a parallel-request cap to protect
  the single GPU. Note these limits protect the box; they are not what
  satisfies the module's rate-limiting requirement (see "Module claims").
- **Logs.** Every request is logged with key, model, and token counts, so
  "what is the box actually used for" is a query.

The models on offer are defined in `litellm-config.yaml` in the repo, so
trying a new model is a PR.

**No SLA.** The box lives in a flat. It is generally on, but power, ISP, or a
reboot can take it away without notice. The architecture treats that as
normal, not as an incident: production jobs wait, experiments resume when it
is back.

### Access for experimentation

Tailscale node sharing shares the GX10 into each teammate's own free
tailnet. Two levels of access:

- **API access**: with their personal LiteLLM key, experiments run from their
  laptop against the same interface production uses.
- **Shell login**: team members can log into the GX10 via their Tailscale
  access, with ordinary non-sudo Linux accounts (sshd is bound to the
  tailscale interface), for experiments that need more than the API (own
  scripts, model tinkering).

The GPU and its memory are shared with production inference. No technical
enforcement at team scale: the production model stays loaded, bigger
experiments get announced in Slack first, and the GPU dashboard keeps
usage visible to everyone.

## AI request flow

Card and deck content generation is asynchronous by design:

1. A user action creates a generation job in a postgres-backed queue
   (pg-boss or a plain jobs table; postgres is already there, no Redis).
2. A worker in the api pulls jobs, calls the GX10 through LiteLLM, stores
   results, marks the job done or failed with retry.
3. The UI shows job state; when the box is offline, jobs are visibly queued
   instead of failing.

This gives us retry handling, per-user generation limits, and graceful
degradation as queue features rather than scattered error handling.

One path stays synchronous: an interactive generation preview that streams
tokens to the browser (api proxies the SSE stream from LiteLLM). The LLM
module explicitly requires handling streaming responses, and a queue alone
never streams.

## Observability

Prometheus and Grafana run on the VPS as their own compose file, next to
but separate from the app bundle — the single-command eval run stays
lean, and monitoring lives on the reliable machine. That placement is
deliberate: monitoring must not share fate with the least reliable
thing it watches. Hosted on the GX10 it could never alert on the GX10
being down; on the VPS, that is the alert that works best.

- api exposes `/metrics` (prom-client): request rates, latencies, and the
  queue gauges (jobs pending / running / failed, job duration). Queue depth is
  the main operational signal in this design: it answers "is the AI box down
  or drowning" at a glance.
- postgres-exporter and node_exporter on the VPS (host metrics: disk,
  memory, CPU — the "disk filling" alert needs them).
- On the GX10, scraped over the tailnet: LiteLLM's built-in prometheus
  metrics (requests, latency, tokens per key) plus node_exporter and the
  NVIDIA DCGM exporter (GPU utilization). When the box is offline these
  targets go dark and the alert fires — which is the point.
- Alerting rules that mean something: queue depth threshold, api down,
  GX10 unreachable, disk filling. Alerts go to the team Slack via webhook.
- Grafana access is secured (built-in auth, admin password from env), which is
  an explicit module requirement. Served through nginx, so the team can
  check dashboards from anywhere without joining any tailnet.

For the evaluation demo the dashboards are simply a URL — no Tailscale
needed for the monitoring module, independent of the AI demo path.

## Module claims

| Module                                                 | Points | Status                      |
| ------------------------------------------------------ | ------ | --------------------------- |
| AI: Complete LLM system interface (Major)              | 2      | already planned (A17)       |
| DevOps: Monitoring with Prometheus and Grafana (Major) | 2      | claimed in the modules plan |
| DevOps: Health check / status page, backups (Minor)    | 1      | under consideration (A20)   |
| Cybersecurity: WAF/ModSecurity + Vault (Major)         | 2      | skipped for now             |

### AI: Complete LLM system interface (Major)

Generation from user input runs through the job flow, streaming through the
preview path, error handling through queue retries. Rate limiting is
implemented in the api: a per-user daily generation quota and a pending-job
cap in postgres, plus a limit on the streaming endpoint. That is our own code
and demonstrable in the plain compose run; the LiteLLM key limits are only
the infrastructure backstop.

### DevOps: Monitoring with Prometheus and Grafana (Major)

The Observability section covers every bullet of the module: prometheus,
exporters, custom dashboards (queue, GPU), alerting rules, secured Grafana.

### DevOps: Health check / status page, backups, disaster recovery (Minor)

Health endpoints already exist per app; a status page reads them plus queue
state. Nightly pg_dump to off-VPS storage, restore procedure documented and
tested once.

### Cybersecurity: WAF/ModSecurity + Vault (Major)

Skipped for now (per review on the plan PR). The nginx we deploy anyway
could carry ModSecurity and Vault could replace env-file secrets, so the
option stays cheap to revisit if the module points are ever needed.

### Not claimed

ELK (second observability Major): Elasticsearch alone wants more memory
than the rest of the stack combined — a poor fit for a small VPS — and at
our scale structured log search adds little over metrics plus
`docker compose logs`. RAG: possible later on the same box, needs its own
design.
