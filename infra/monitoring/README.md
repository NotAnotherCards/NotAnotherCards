# Monitoring Stack (Prometheus & Grafana)

The monitoring stack runs as its own standalone Docker Compose project on the VPS, separate from the core application bundle. It monitors VPS health, database metrics, NestJS API performance, and GX10 AI inference.

> **Temporary GX10 scrape path:** the team VPS is not on the tailnet yet
> (#193), so the three GX10 jobs are scraped through the public HTTPS proxy
> `ai.dustyway.org` (allow-listed to the production VPS IP, 403 elsewhere).
> `GX10_METRICS_MODE=proxy` and `GX10_METRICS_HOST=ai.dustyway.org` select
> this path. After #193, set the mode to `tailnet` and the host to the GX10
> tailnet IP. The renderer then uses direct HTTP ports 4000, 9400, and 9100
> with each exporter's native metrics path.

Architecture and design rationale are documented in [`docs/deployment.md`](../../docs/deployment.md).

---

## Topology & Scrape Targets

```
┌─────────────────────────── VPS (Hetzner) ───────────────────────────┐
│                                                                     │
│  Host Nginx (HTTPS with HSTS) ───────────┐                          │
│                                          │                          │
│  ┌─ Monitoring Compose ─────────────┐    ▼                          │
│  │                                  │ ┌───────────────────────────┐ │
│  │ ┌────────────┐   Scrapes local   │ │  Grafana (:3001)          │ │
│  │ │            │──────────────────>│ │  - URL: grafana.notanother...│
│  │ │ Prometheus │   targets         │ │  - Secured with admin auth│ │
│  │ │   (:9090)  │                   │ │  - 3 Provisioned Dashboards│ │
│  │ └─────┬──────┘                   │ └───────────────────────────┘ │
│  │       │                          │                               │
│  │       ├─► Alertmanager (:9093) ──┼──► (Slack Notifications)      │
│  │       │                          │                               │
│  └───────┼──────────────────────────┘                               │
│          │                                                          │
│          ├─► API (/metrics on :3000: HTTP latency, AI queue depth)  │
│          ├─► postgres-exporter (:9187: DB queries, connections)     │
│          ├─► node-exporter (:9100: Host CPU, RAM, Disk)             │
│          │                                                          │
│          │ Scrapes over HTTPS proxy (ai.dustyway.org, until #193)   │
│          ▼                                                          │
└──────────┼──────────────────────────────────────────────────────────┘
           │
           ▼
┌── GX10 AI Supercomputer (via ai.dustyway.org proxy) ──┐
│                                                       │
│  ├─► LiteLLM Gateway (/metrics)                       │
│  ├─► Node Exporter (/node/metrics)                    │
│  └─► NVIDIA DCGM Exporter (/dcgm/metrics GPU stats)   │
└───────────────────────────────────────────────────────┘
```

---

## Pre-provisioned Dashboards & Alerts

### Dashboards (`infra/monitoring/grafana/provisioning/dashboards/json/`)

1. **AI Generation & Queue Performance (`ai-queue-dashboard.json`):**
   - Pending, processing, and failed job depth gauges
   - Throughput & completion rates (`rate(ai_jobs_completed_total[5m])`)
   - Job processing duration percentiles (`ai_job_duration_seconds`)
   - Token consumption breakdown by model (`rate(ai_tokens_consumed_total[1h])`)
2. **API & System Performance (`api-system-dashboard.json`):**
   - HTTP request & 4xx/5xx error rates by route
   - HTTP response latency percentiles (p50, p95)
   - PostgreSQL metrics: Active connections, transaction rates (commits/rollbacks), buffer cache hit ratio %, DB size
   - Node.js process CPU & heap memory
   - Host VPS CPU %, RAM %, and root disk space used %
3. **GX10 AI Supercomputer & GPU (`gx10-gpu-dashboard.json`):**
   - NVIDIA GB10 GPU utilization %, temperature (°C), and power usage (Watts)
   - LiteLLM request volume and token throughput

### Alerts (`infra/monitoring/prometheus/rules/alerts.yml`)

- `ApiDown` (critical, 1m) — triggers when API `/metrics` is unreachable for 1m.
- `PostgresDown` (critical, 1m) — triggers when PostgreSQL database exporter is unreachable for 1m.
- `LiteLlmGatewayDown` (critical, 5m) — triggers when LiteLLM AI gateway is unreachable (via the ai.dustyway.org proxy until #193) for 5m.
- `Gx10NodeExporterDown` (warning, 15m) — triggers when GX10 host exporter is unreachable for 15m.
- `Gx10GpuExporterDown` (warning, 15m) — triggers when GX10 NVIDIA DCGM GPU exporter is unreachable for 15m.
- `AiQueueDepthHigh` (warning, 5m) — triggers when pending queue depth exceeds 10 jobs for 5m (guarded by `ai_queue_depth_scrape_success == 1` so stale values cannot fire it).
- `AiQueueDepthScrapeFailed` (warning, 2m) — triggers when the API cannot refresh queue depth from the database.
- `DiskFilling` (warning, 10m) — triggers when VPS root disk space is below 15% free for 10m.

The thresholds reflect impact and scrape cadence: API/PostgreSQL failures page
after four missed 15-second scrapes; a five-minute LiteLLM outage is critical
because it blocks generation while tolerating brief restarts; GX10 exporters
wait 15 minutes because losing telemetry alone is not request-path failure. A
queue above 10 for five minutes is sustained backlog for the single-job worker,
and 15% free disk leaves intervention time before writes fail. Queue alerts are
suppressed while the database-derived gauge is stale, with a separate
two-minute collection-failure alert instead.

---

## Quick Start (VPS Operations)

### 1. Configure Environment and Secrets

On the VPS, install the environment file and the dedicated Slack secret. The
webhook deliberately lives in its own ignored file instead of `.env`, keeping
it out of Compose interpolation and process/container environments:

```bash
sudo install -m 600 -o deploy -g deploy \
  /opt/notanothercards/infra/monitoring/.env.example \
  /opt/notanothercards/infra/monitoring/.env
sudo -u deploy nano /opt/notanothercards/infra/monitoring/.env

# Alertmanager runs as uid/gid 65534. The deploy user owns the directory so it
# can replace the secret; only Alertmanager (and root) can read the file.
sudo install -d -m 750 -o deploy -g 65534 \
  /opt/notanothercards/infra/monitoring/secrets
sudo install -m 400 -o 65534 -g 65534 /dev/stdin \
  /opt/notanothercards/infra/monitoring/secrets/slack_webhook <<'EOF'
https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK
EOF
```

Compose mounts that file read-only as `/run/secrets/slack_webhook`, and
Alertmanager reads it through `api_url_file`. Both a missing/empty file and
unsafe ownership or permissions make deployment fail immediately. Remove any
obsolete `SLACK_WEBHOOK_URL=...` line from `.env`; the deployment also scrubs
that line after validating the dedicated file.

For the current proxy route, keep:

```dotenv
GX10_METRICS_MODE=proxy
GX10_METRICS_HOST=ai.dustyway.org
```

After #193 joins the VPS to the tailnet, switch without editing Prometheus YAML:

```dotenv
GX10_METRICS_MODE=tailnet
GX10_METRICS_HOST=100.64.0.1
```

Ensure valid secure values for:

- `GRAFANA_ADMIN_USER` and `GRAFANA_ADMIN_PASSWORD` (mandatory)
- `POSTGRES_EXPORTER_DATA_SOURCE_NAME` (matching credentials in `/opt/notanothercards/.env`)
- `infra/monitoring/secrets/slack_webhook` (the team Slack Incoming Webhook URL)

Every production deployment submits `MonitoringDeliverySmokeTest` to
Alertmanager and fails unless its receiver-specific HTTP request counters prove
that at least one request completed without failure. This sends one short
smoke-test message to the alerts channel. `pnpm test:infra` exercises the same
Alertmanager path against a local Slack-compatible endpoint and also proves an
endpoint returning only HTTP 503 cannot pass, so CI does not contact the real
workspace.

### 2. Start the Monitoring Stack

```bash
cd /opt/notanothercards/infra/monitoring
sudo -u deploy docker compose \
  -f docker-compose.yml \
  --env-file .env \
  up -d --wait
```

Check running containers:

```bash
sudo -u deploy docker compose \
  -f docker-compose.yml \
  --env-file .env \
  ps
```

### 3. Nginx Reverse Proxy Setup

Copy the Nginx configuration to enable public access with TLS and HSTS:

```bash
sudo cp /opt/notanothercards/infra/vps/grafana.notanothercards.com.conf /etc/nginx/sites-available/
sudo ln -sf /etc/nginx/sites-available/grafana.notanothercards.com.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Issue Let's Encrypt TLS Certificate via Certbot
sudo certbot --nginx -d grafana.notanothercards.com
```

---

## Maintenance & Password Rotation

### Rotate Grafana Admin Password
If a persistent Grafana volume has already been initialized, environment variable changes do not reset the existing database credentials. Use the Grafana CLI inside the container:

```bash
# The image ships the `grafana` binary with a `cli` subcommand
# (there is no standalone `grafana-cli` executable in grafana/grafana:13.2.1).
sudo -u deploy docker compose \
  -f /opt/notanothercards/infra/monitoring/docker-compose.yml \
  --env-file /opt/notanothercards/infra/monitoring/.env \
  exec grafana grafana cli admin reset-admin-password NEW_PASSWORD_HERE
```

Afterwards update `GRAFANA_ADMIN_PASSWORD` in `/opt/notanothercards/infra/monitoring/.env` to match.

---

## Verification & Diagnostic Commands

1. **Verify API Metrics Endpoint:**

   ```bash
   curl http://127.0.0.1:3000/metrics
   ```

2. **Verify Prometheus Target Scraping:**

   ```bash
   curl http://127.0.0.1:9090/api/v1/targets | jq .
   ```

3. **Verify Grafana Health:**

   ```bash
   curl -I http://127.0.0.1:3001/api/health
   ```

4. **Verify Alertmanager Health:**

   ```bash
   curl http://127.0.0.1:9093/-/healthy
   ```

5. **Verify the Compose Secret Mount:**

   ```bash
   sudo -u deploy docker compose \
     -f /opt/notanothercards/infra/monitoring/docker-compose.yml \
     --env-file /opt/notanothercards/infra/monitoring/.env \
     exec -T -u 65534 alertmanager \
     cat /run/secrets/slack_webhook >/dev/null \
     && echo "OK: Slack webhook secret is readable"
   ```

6. **View Monitoring Logs:**
   ```bash
   sudo -u deploy docker compose -f /opt/notanothercards/infra/monitoring/docker-compose.yml --env-file /opt/notanothercards/infra/monitoring/.env logs --tail=100 -f
   ```
