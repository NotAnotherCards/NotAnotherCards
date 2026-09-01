# Monitoring Stack (Prometheus & Grafana)

The monitoring stack runs as its own standalone Docker Compose project on the VPS, separate from the core application bundle. It monitors VPS health, database metrics, NestJS API performance, and GX10 AI inference over Tailscale.

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
│          │ Scrapes over Tailscale (WireGuard)                       │
│          ▼                                                          │
└──────────┼──────────────────────────────────────────────────────────┘
           │
           ▼
┌── GX10 AI Supercomputer (Home Box / Tailnet) ──┐
│                                                │
│  ├─► LiteLLM Gateway (:4000/metrics/)          │
│  ├─► Node Exporter (:9100)                     │
│  └─► NVIDIA DCGM Exporter (:9400 GPU metrics)  │
└────────────────────────────────────────────────┘
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
- `LiteLlmGatewayDown` (critical, 5m) — triggers when LiteLLM AI gateway is unreachable over Tailscale for 5m.
- `Gx10NodeExporterDown` (warning, 15m) — triggers when GX10 host exporter is unreachable for 15m.
- `Gx10GpuExporterDown` (warning, 15m) — triggers when GX10 NVIDIA DCGM GPU exporter is unreachable for 15m.
- `AiQueueDepthHigh` (warning, 5m) — triggers when pending queue depth exceeds 10 jobs for 5m.
- `DiskFilling` (warning, 10m) — triggers when VPS root disk space is below 15% free for 10m.

---

## Quick Start (VPS Operations)

### 1. Configure Environment & Secrets

On the VPS, install the environment file and secrets with mode `600` owned by `deploy:deploy`:

```bash
# 1. Environment variables
sudo install -m 600 -o deploy -g deploy \
  /opt/notanothercards/infra/monitoring/.env.example \
  /opt/notanothercards/infra/monitoring/.env
sudo -u deploy nano /opt/notanothercards/infra/monitoring/.env

# 2. Slack Webhook Secret (mode 600)
# Note: Alertmanager uses api_url_file because Alertmanager static configuration
# does not support shell environment variable interpolation.
sudo install -d -m 700 -o deploy -g deploy /opt/notanothercards/infra/monitoring/secrets
sudo tee /opt/notanothercards/infra/monitoring/secrets/slack_webhook >/dev/null <<'EOF'
https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK
EOF
sudo chown deploy:deploy /opt/notanothercards/infra/monitoring/secrets/slack_webhook
sudo chmod 600 /opt/notanothercards/infra/monitoring/secrets/slack_webhook
```

Ensure secure values for:

- `GRAFANA_ADMIN_USER` and `GRAFANA_ADMIN_PASSWORD` (mandatory)
- `POSTGRES_EXPORTER_DATA_SOURCE_NAME` (matching credentials in `/opt/notanothercards/.env`)
- `infra/monitoring/secrets/slack_webhook` (your Slack Incoming Webhook URL)

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
sudo -u deploy docker compose \
  -f /opt/notanothercards/infra/monitoring/docker-compose.yml \
  --env-file /opt/notanothercards/infra/monitoring/.env \
  exec grafana grafana-cli admin reset-admin-password <NEW_PASSWORD>
```

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

5. **View Monitoring Logs:**
   ```bash
   sudo -u deploy docker compose -f /opt/notanothercards/infra/monitoring/docker-compose.yml --env-file /opt/notanothercards/infra/monitoring/.env logs --tail=100 -f
   ```
