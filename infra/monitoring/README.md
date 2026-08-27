# Monitoring Stack (Prometheus & Grafana)

The monitoring stack runs as its own standalone Docker Compose project on the VPS, separate from the core application bundle. It monitors VPS health, database metrics, NestJS API performance, and GX10 AI inference over Tailscale.

Architecture and design rationale are documented in [`docs/deployment.md`](../../docs/deployment.md).

---

## Topology & Scrape Targets

```
┌─────────────────────────── VPS (Hetzner) ───────────────────────────┐
│                                                                     │
│  Host Nginx (HTTPS) ─────────────────────┐                          │
│                                          │                          │
│  ┌─ Monitoring Compose ─────────────┐    ▼                          │
│  │                                  │ ┌───────────────────────────┐ │
│  │ ┌────────────┐   Scrapes local   │ │  Grafana (:3001)          │ │
│  │ │            │──────────────────>│ │  - URL: grafana.notanother...│
│  │ │ Prometheus │   targets         │ │  - Secured with admin auth│ │
│  │ │   (:9090)  │                   │ └───────────────────────────┘ │
│  │ └─────┬──────┘                   │                               │
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
│  ├─► LiteLLM Gateway (:4000/metrics)           │
│  ├─► Node Exporter (:9100)                     │
│  └─► NVIDIA DCGM Exporter (:9400 GPU metrics)  │
└────────────────────────────────────────────────┘
```

---

## Quick Start (VPS Operations)

### 1. Configure Environment
On the VPS, install the environment file with mode `600` owned by `deploy:deploy`:

```bash
sudo install -m 600 -o deploy -g deploy \
  /opt/notanothercards/infra/monitoring/.env.example \
  /opt/notanothercards/infra/monitoring/.env
sudo -u deploy nano /opt/notanothercards/infra/monitoring/.env
```

Ensure secure values for:
- `GRAFANA_ADMIN_USER` and `GRAFANA_ADMIN_PASSWORD`
- `POSTGRES_EXPORTER_DATA_SOURCE_NAME` (matching credentials in `/opt/notanothercards/.env`)

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
Copy the Nginx configuration to enable public access with TLS:

```bash
sudo cp infra/vps/grafana.notanothercards.com.conf /etc/nginx/sites-available/
sudo ln -s /etc/nginx/sites-available/grafana.notanothercards.com.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Issue Let's Encrypt TLS Certificate via Certbot
sudo certbot --nginx -d grafana.notanothercards.com
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

4. **View Monitoring Logs:**
   ```bash
   sudo -u deploy docker compose -f infra/monitoring/docker-compose.yml --env-file infra/monitoring/.env logs --tail=100 -f
   ```
