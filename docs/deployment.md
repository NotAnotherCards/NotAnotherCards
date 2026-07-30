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
                   ├─ web (static build)            │    keys, rate limits, logging
                   ├─ api (NestJS)                  ├─ inference server (Ollama or vLLM)
                   ├─ postgres ── tailscale ───────>│    bound to tailscale interface
                   ├─ prometheus                    ├─ node_exporter + DCGM exporter
                   └─ grafana                       └─ tailscaled
```

- The VPS is reachable from the internet over HTTPS only.
- The GX10 (ASUS Ascent GX10, 128 GB unified memory) has no open ports. It is
  reachable only inside the tailnet. Tailscale traffic is WireGuard-encrypted,
  which satisfies the subject's HTTPS rule for backend connections; traffic
  inside the compose network is allowed to be plain (III.3).
- The api never talks to the GX10 during a user request, see "AI request flow".

## One compose, three contexts

The same `docker-compose.yml` runs in three places:

1. **Evaluation / any dev machine**: `docker compose up` starts web, api,
   postgres, prometheus, grafana. The AI endpoint is whatever
   `AI_API_BASE` points to. If it points nowhere, generation jobs queue and the
   UI shows them as waiting; nothing errors. The compose must pass this test
   with no tailnet at all, since "runs with a single command" is
   rejection-level.

   For the live AI demo during evaluation, the plan is Tailscale on the eval
   machine (userspace mode, no root needed; falls back to relaying over 443,
   so campus firewalls are not a problem) with `AI_API_BASE` pointing at the
   GX10. That also puts the GPU dashboard live during the defense. Running a
   model on the eval machine itself is not an option, so plan B for the box
   being unreachable on eval day is pointing `AI_API_BASE` at a hosted
   OpenAI-compatible provider instead; costs cents for a demo and needs no
   code change. Without any endpoint the app still runs and shows jobs as
   queued, which is compliant but not much of a demo.
2. **The VPS**: same compose, plus nginx/certbot, `AI_API_BASE` pointing at the
   GX10 through the tailnet.
3. **A teammate's machine during AI work**: same compose, `AI_API_BASE`
   pointing at the GX10 with a personal key (see "Access").

## Deploys

- GitHub Actions deploys on merge to main: SSH with a deploy key to a
  restricted deploy user on the VPS, `docker compose pull && up -d`. Merging a
  PR is deploying; reverting a PR is rolling back. Nobody needs shell access
  for routine work.
- A second team member gets SSH access as backup, so a broken deploy never
  waits on one person.
- Compose file, nginx config, and this document live in the repo. The setup
  must be reproducible on a fresh VPS from the repo alone.
- Production env vars are documented in `.env.example` files, values stay on
  the server (subject III.3).

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

Teammates do not join the box owner's tailnet. Tailscale node sharing shares
just the GX10 into each teammate's own free tailnet. Two levels of access:

- **API access**: with their personal LiteLLM key, experiments run from their
  laptop against the same interface production uses.
- **Shell accounts**: teammates get ordinary non-sudo Linux accounts on the
  box, over sshd bound to the tailscale interface, for experiments that need
  more than the API (own scripts, model tinkering).

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

Prometheus and Grafana run in the compose:

- api exposes `/metrics` (prom-client): request rates, latencies, and the
  queue gauges (jobs pending / running / failed, job duration). Queue depth is
  the main operational signal in this design: it answers "is the AI box down
  or drowning" at a glance.
- postgres-exporter for the database.
- On the GX10: LiteLLM's built-in prometheus metrics (requests, latency,
  tokens per key) plus node_exporter and NVIDIA DCGM exporter (GPU
  utilization). Prometheus on the VPS scrapes them over the tailnet. On an
  eval machine these targets show as down while everything else works, which
  is the monitoring doing its job.
- Alerting rules that mean something: queue depth threshold, api down, disk
  filling. Alerts go to the team Slack via webhook.
- Grafana access is secured (built-in auth, admin password from env), which is
  an explicit module requirement.

## Module claims

| Module | Points | Status in modules plan | How this plan delivers it |
|---|---|---|---|
| AI: Complete LLM system interface (Major) | 2 | already planned (A17) | generation from user input via the job flow, streaming via the preview path, error handling via queue retries. Rate limiting is implemented in the api: per-user daily generation quota and pending-job cap in postgres, plus a limit on the streaming endpoint. This is our own code and demonstrable in the plain compose run; LiteLLM key limits are only the infrastructure backstop |
| DevOps: Monitoring with Prometheus and Grafana (Major) | 2 | proposed here, not yet claimed | the Observability section covers every bullet: prometheus, exporters, custom dashboards (queue, GPU), alerting rules, secured Grafana |
| DevOps: Health check / status page, backups, disaster recovery (Minor) | 1 | under consideration (A20) | health endpoints already exist per app, a status page reads them plus queue state; nightly pg_dump to off-VPS storage; restore procedure documented and tested once |
| Cybersecurity: WAF/ModSecurity + Vault (Major) | 2 | not claimed, stretch option | the nginx we deploy anyway can carry ModSecurity; Vault would replace env-file secrets. Real extra work, only worth claiming if someone wants to own it |

Not claimed from this plan: ELK (second observability Major; heavy on a school
machine and adds little over metrics at our scale), RAG (possible later on the
same box, needs its own design).

## Open questions for the team

1. Who owns the monitoring module? Infra is maybe a third of it; dashboards
   and alerting are the substance, and evaluation asks each member to defend
   their contribution.
2. First generation feature: examples/hints for existing cards, or full deck
   generation? Decides the first job type and prompt work.
3. Evaluation demo for AI: primary plan is Tailscale on the eval machine with
   the live GX10; plan B is a hosted OpenAI-compatible provider behind the
   same env var. Decide which provider and who pays the few cents near the
   end.
4. Do we claim the monitoring Major? It adds 2 points and the ops we want
   anyway; it also adds dashboard/alerting work someone must own.
5. Backup SSH person for the VPS: who?
