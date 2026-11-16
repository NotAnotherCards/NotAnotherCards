# Deployment and AI infrastructure plan

Status: current deployment architecture.

> **Current Contabo deployment:** the GX10 is not part of this deployment. The
> three GX10 scrape jobs and their alert rules are disabled in
> `infra/monitoring`, and AI generation uses Groq with OpenRouter failover.
> The GX10 topology remains target architecture only if the box is available
> again.

The subject sets one hard rule that shapes everything here: deployment must use
containers and run with a single command (III.2, rejection-level). Evaluation
happens on a school machine, not on our servers. So the compose file is the
canonical deployment. Our live server just runs that same compose continuously,
and the AI box is an external backend behind a config value.

## Topology

```
users ── HTTPS ──> production VPS (public + tailnet)
                   ├─ nginx + certbot (app / grafana / apex landing)
                   ├─ web (static build)     :5173
                   ├─ landing (static)       :5174
                   ├─ api (NestJS) ───────────────────────┐
                   ├─ postgres                             │
                   ├─ monitoring compose:                  │ WireGuard-encrypted
                   │    ├─ prometheus ─────────────────────┘ tailnet data path
                   │    └─ grafana                              │
                   └─ node_exporter                                 ▼
                                                   GX10 (target architecture only)
                                                   ├─ LiteLLM proxy :4000
                                                   ├─ inference server (Ollama)
                                                   ├─ node_exporter :9100
                                                   ├─ DCGM exporter :9400
                                                   └─ tailscaled

teammates ── HTTPS ──> ai.dustyway.org ── tailnet ──> LiteLLM
headscale.dustyway.org ──> tailnet coordination only (not the data path)
```

- The VPS is reachable from the internet over HTTPS only.
- The production VPS does not connect to the GX10 in the current deployment.
  If the box returns, the target topology uses the existing encrypted tailnet
  without changing the public application surface.
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

   Hosted providers are used for the live AI demo, so evaluation needs no
   tailnet access. Without any endpoint the app still runs and shows jobs as
   queued.

2. **The VPS**: the base compose plus `docker-compose.production.yml`, with
   host nginx/certbot serving `app.notanothercards.com`,
   `grafana.notanothercards.com`, and the apex landing page
   `notanothercards.com`. The production override removes the postgres host
   port and binds the API, web, and landing diagnostic ports to loopback. The
   non-secret AI settings in `/opt/notanothercards/.env` are:

   ```dotenv
   AI_API_BASE=https://api.groq.com/openai/v1
   AI_API_KEY=<Groq key>
   AI_FALLBACK_API_BASE=https://openrouter.ai/api/v1
   AI_FALLBACK_API_KEY=<OpenRouter key>
   AI_DEFAULT_MODEL=balanced
   ```

   Keep both base URLs without trailing slashes. The API fails over only on
   connection errors, HTTP 5xx/429 responses, or a stream failure before the
   first delta. It never fails over after a delta or for `AiParseError`.

3. **A teammate's machine during AI work**: same compose, using personal
   provider keys kept outside the repository.

## Hosted AI providers

The provider aliases and concrete model IDs are documented in
[`docs/adr/ai-provider-migration.md`](adr/ai-provider-migration.md). Groq is
the primary provider and OpenRouter is the budget-capped fallback. The
production demo budget is approximately $10.

### Production environment

`/opt/notanothercards/.env` holds the provider pairs:

```dotenv
AI_API_BASE=https://api.groq.com/openai/v1
AI_API_KEY=<groq key>
AI_FALLBACK_API_BASE=https://openrouter.ai/api/v1
AI_FALLBACK_API_KEY=<openrouter key>
AI_DEFAULT_MODEL=balanced
# TEMPORARY: moderation bypass while generation moves to hosted providers.
# Remove when fail-closed moderation is restored (see the ADR follow-up).
MODERATION_ALLOW_ALL=1
```

### Watching the provider (first 24 h after a provider change)

`ai_usage.provider` records the API base that served each request, so a
healthy rollout shows `groq.com` rows with OpenRouter appearing only
during failover:

```sql
SELECT provider, model, count(*)
FROM ai_usage
WHERE created_at > now() - interval '24 hours'
GROUP BY 1, 2 ORDER BY 3 DESC;

SELECT status, count(*), max(created_at)
FROM ai_generation_jobs
WHERE created_at > now() - interval '24 hours'
GROUP BY 1;

SELECT created_at, error
FROM ai_generation_jobs
WHERE status = 'failed' AND created_at > now() - interval '24 hours'
ORDER BY created_at DESC LIMIT 20;
```

Run them with
`sudo -u deploy docker compose -f docker-compose.yml -f docker-compose.production.yml exec postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"`
from `/opt/notanothercards`.

### Rollback runbook (AI provider)

The GX10 gateway is no longer reachable, so rollback means moving traffic
off the failing hosted provider rather than returning to self-hosting.
Use the first step that applies:

1. **Groq is down or rate-limited and OpenRouter is healthy.** Nothing has to
   change: failover already happens per request. Confirm that OpenRouter
   rows appear in `ai_usage` and that failed jobs are not increasing.
2. **Groq misbehaves in a way failover does not catch** (bad output, parse
   errors, latency close to the timeout). Make OpenRouter the primary: in
   `/opt/notanothercards/.env`, swap `AI_API_BASE`/`AI_API_KEY` with the
   `AI_FALLBACK_*` pair. Then recreate the api with
   `sudo -u deploy docker compose -f docker-compose.yml -f docker-compose.production.yml up -d --wait api`.
   Or re-run `deploy.yml` (`workflow_dispatch`) so the deploy's
   checks also run.
3. **The model choice is the problem.** Point `AI_DEFAULT_MODEL` at another
   alias (`fast` or `smart`) and recreate the api as in step 2.
4. **Both providers fail or the budget is exhausted.** Set `AI_MOCK=1` so
   generation keeps answering without spending anything, recreate the api,
   and tell the team that generation is serving mock cards.
5. **The application code is at fault.** Revert the PR on `main`; the merge
   triggers `deploy.yml`. Review migrations first. `ai_usage.provider` is
   additive, and older code ignores it.

After any step, re-run the watch queries above. Record what happened in the
team channel and in the ADR if the provider decision changes. Keep
`MODERATION_ALLOW_ALL=1` in place until the moderation follow-up epic lands;
a provider rollback does not change it.

## Deploys

- GitHub Actions deploys on merge to main (`.github/workflows/deploy.yml`):
  SSH with a dedicated deploy key to the `deploy` user on the project VPS,
  then run the base and production compose files with `--wait`. Merging a PR
  is deploying; reverting a PR is rolling back.
- The compose files, HTTP bootstrap nginx configs
  (`infra/vps/app.notanothercards.com.conf`,
  `infra/vps/grafana.notanothercards.com.conf`,
  `infra/vps/notanothercards.com.conf`, and
  `infra/vps/www.notanothercards.com.conf`), and the reproducible setup guide
  (`infra/vps/README.md`) live in the repo.
- After the stacks are up, the deployment verifies the monitoring stack, its
  Prometheus targets, and the public endpoints: application and Grafana health
  plus the apex landing page (`https://notanothercards.com/` and `/privacy`
  over hostname-validated HTTPS, a real 404 for an unknown path, the
  HTTP-to-HTTPS redirect, and a certificate naming the apex domain), plus the
  `www` redirect to the apex over HTTP and certificate-validated HTTPS. Any of
  those failing fails the deployment.
- `pnpm test:infra` validates the same nginx host configurations offline: it
  loads all four virtual hosts into a throwaway nginx, asserts the apex site
  proxies to the loopback landing container on `5174`, and proves the
  application and Grafana routes still reach `5173` and `3001`. It verifies
  that `www` redirects directly to the apex over HTTP and trusted test HTTPS,
  preserving paths and query strings.
- Production values stay in `/opt/notanothercards/.env` and the team password
  manager; deployment credentials use GitHub's protected `production`
  environment (subject III.3).
- `MODERATION_ALLOW_ALL` (api) bypasses the deck-publishing classifier when set
  to `1`; use it only for tests and demos. Staging must unset it when the
  moderation gate deploys, or every deck passes. Publish snapshots the content;
  edits never unpublish it, and republishing replaces the snapshot. Existing
  public decks without a snapshot must be republished to appear.
- The checked-in `moderation-thorough` gateway alias currently maps to
  ShieldGemma 9B and has a `Yes` (unsafe) / `No` (safe) application parser.
  It makes report-triggered re-checks operational before round two. Round two
  remains a release gate for the final independent model: if it replaces
  ShieldGemma with a model that has a different native response, update the
  parser and its real-output contract tests in the same deployment.
- `MODERATION_OPERATOR_KEY` protects report listing and manual takedown while
  the application has no moderator role. Generate and store it like any other
  production secret. Reporters default to 10 reports per rolling 24 hours;
  `MODERATION_MAX_DAILY_REPORTS_PER_USER` changes that cap, and
  `MODERATION_RECHECK_WINDOW_HOURS` changes the clean-result cache (default
  24 hours).

### Public landing at the apex domain

`https://notanothercards.com` is served by the host Nginx site
`infra/vps/notanothercards.com.conf`, which proxies to the landing container
on loopback `127.0.0.1:5174`. DNS carries `A 95.111.246.241` and
`AAAA 2a02:c207:3021:0712::1`; verify both address families where those
records are configured:

```bash
dig +short A    notanothercards.com
dig +short AAAA notanothercards.com
dig +short A    www.notanothercards.com
dig +short AAAA www.notanothercards.com
```

Install and enable the site on a clean host, then let Certbot add TLS:

```bash
sudo apt-get install nginx certbot python3-certbot-nginx
cd /opt/notanothercards
sudo cp infra/vps/notanothercards.com.conf /etc/nginx/sites-available/
sudo ln -sf /etc/nginx/sites-available/notanothercards.com.conf \
           /etc/nginx/sites-enabled/
sudo cp infra/vps/www.notanothercards.com.conf /etc/nginx/sites-available/
sudo ln -sf /etc/nginx/sites-available/www.notanothercards.com.conf \
           /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d notanothercards.com
sudo certbot --nginx --no-redirect -d www.notanothercards.com
sudo certbot renew --dry-run
```

Certbot rewrites the installed copy, so never copy the repository file over it
again. The `www` site redirects directly to the apex on both protocols;
`--no-redirect` prevents an extra redirect through HTTPS on `www`.
On an existing host, install only the new `www` site and issue its certificate
before deploying the new checks; follow the _Adding www to an existing
production host_ steps in [`infra/vps/README.md`](../infra/vps/README.md).
The deployment workflow verifies host sites but does not install them.
Health checks:

```bash
curl --fail https://notanothercards.com/
curl --fail https://notanothercards.com/privacy
curl -o /dev/null -w '%{http_code} %{redirect_url}\n' http://notanothercards.com/
curl -o /dev/null -w '%{http_code}\n' https://notanothercards.com/not-a-real-page
curl -sS -o /dev/null -w '%{http_code} %{redirect_url}\n' \
  'http://www.notanothercards.com/privacy?source=www'
curl -sS -o /dev/null -w '%{http_code} %{redirect_url}\n' \
  'https://www.notanothercards.com/privacy?source=www'
```

Troubleshooting starts with `sudo nginx -t`, `sudo systemctl status nginx`,
`sudo certbot certificates`, and `curl --fail http://127.0.0.1:5174/health`.
Roll back by removing the enabled sites and their certificates, then reverting
the deploy commit that requires the apex and www endpoints:

```bash
sudo rm /etc/nginx/sites-enabled/notanothercards.com.conf
sudo rm /etc/nginx/sites-enabled/www.notanothercards.com.conf
sudo nginx -t && sudo systemctl reload nginx
sudo certbot delete --cert-name notanothercards.com
sudo certbot delete --cert-name www.notanothercards.com
```

The full runbook — DNS and IPv6 detail, troubleshooting, and why the rollback
needs the deploy commit reverted — is in
[`infra/vps/README.md`](../infra/vps/README.md), section _Landing page at the
apex domain_.

### Password-reset email delivery

Production must configure an email transport in `/opt/notanothercards/.env`.
Docker Compose does not automatically copy arbitrary host variables into a
container, so the API service explicitly forwards the supported mail settings.
Use either Resend:

```dotenv
RESEND_API_KEY=re_replace_with_the_production_key
SMTP_FROM=no-reply@notanothercards.com
```

or SMTP:

```dotenv
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_FROM=no-reply@notanothercards.com
SMTP_USER=replace_with_the_smtp_user
SMTP_PASSWORD=replace_with_the_smtp_password
```

`SMTP_PORT` defaults to `587`, `SMTP_SECURE` defaults to `false`, and
`SMTP_FROM` defaults to `no-reply@notanothercards.com`. When `SMTP_USER` is
empty, the API connects without SMTP authentication. Staging may omit both
`RESEND_API_KEY` and `SMTP_HOST` when disabled email delivery is intentional.

After changing the production environment, redeploy the API and verify that a
transport reached the container without displaying the secret:

```bash
sudo -u deploy docker compose \
  -f /opt/notanothercards/docker-compose.yml \
  -f /opt/notanothercards/docker-compose.production.yml \
  up -d --build --wait api

sudo -u deploy docker compose \
  -f /opt/notanothercards/docker-compose.yml \
  -f /opt/notanothercards/docker-compose.production.yml \
  exec -T api sh -c 'test -n "$RESEND_API_KEY" || test -n "$SMTP_HOST"'
```

## The AI backend

The API uses OpenAI-compatible hosted endpoints. Provider credentials are
stored in the GitHub `production` environment and the project password
manager; they are never committed to the repository. The GX10 is not a
runtime dependency for this deployment.

## AI request flow

Card and deck content generation is asynchronous by design:

1. A user action creates a generation job in a postgres-backed queue
   (pg-boss or a plain jobs table; postgres is already there, no Redis).
2. A worker in the api pulls jobs, calls the configured provider, stores
   results, marks the job done or failed with retry.
3. The UI shows job state; when the box is offline, jobs are visibly queued
   instead of failing.

This gives us retry handling, per-user generation limits, and graceful
degradation as queue features rather than scattered error handling.

One path stays synchronous: an interactive generation preview that streams
tokens to the browser (api proxies the SSE stream from the configured
provider). The LLM
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
- The current deployment monitors the four VPS targets only. GX10 monitoring
  remains in the target architecture and is disabled until the box returns.
- Alerting rules cover queue depth, api health, VPS disk filling, and other
  active services. Alerts go to the team Slack via webhook.
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
and demonstrable in the plain compose run; provider rate limits are only the
infrastructure backstop.

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
