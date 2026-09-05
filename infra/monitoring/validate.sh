#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

E2E_PROJECT="nac-monitoring-validate"
E2E_GRAFANA_PASSWORD="ci-validate-password"
E2E_CREATED_SECRETS=0
E2E_CREATED_NETWORK=0
E2E_STACK_UP=0
RENDER_TMP="$(mktemp -d)"
TEMP_SECRETS_DIR="$(mktemp -d)"

cleanup() {
  if [ "$E2E_STACK_UP" = "1" ]; then
    GRAFANA_ADMIN_PASSWORD="$E2E_GRAFANA_PASSWORD" \
    POSTGRES_EXPORTER_DATA_SOURCE_NAME="postgresql://test:test@postgres:5432/notanothercards?sslmode=disable" \
    GX10_METRICS_HOST="ai.dustyway.org" \
    PROMETHEUS_PORT=9099 GRAFANA_PORT=3009 ALERTMANAGER_PORT=9097 NODE_EXPORTER_PORT=9109 POSTGRES_EXPORTER_PORT=9189 \
    docker compose -p "$E2E_PROJECT" -f "$SCRIPT_DIR/docker-compose.yml" down -v >/dev/null 2>&1 || true
  fi
  if [ "$E2E_CREATED_SECRETS" = "1" ]; then
    rm -f "$SCRIPT_DIR/secrets/slack_webhook"
    rmdir "$SCRIPT_DIR/secrets" >/dev/null 2>&1 || true
  fi
  if [ "$E2E_CREATED_NETWORK" = "1" ]; then
    docker network rm notanothercards_default >/dev/null 2>&1 || true
  fi
  rm -rf "$TEMP_SECRETS_DIR" "$RENDER_TMP"
}
trap cleanup EXIT

echo "==> 1. Validating monitoring Docker Compose configuration..."
GRAFANA_ADMIN_PASSWORD="ci-test-password" \
POSTGRES_EXPORTER_DATA_SOURCE_NAME="postgresql://test:test@postgres:5432/notanothercards?sslmode=disable" \
GX10_METRICS_HOST="ai.dustyway.org" \
docker compose -f "$SCRIPT_DIR/docker-compose.yml" config --quiet

echo "==> 1b. Validating fail-safe empty password rejection..."
if (unset GRAFANA_ADMIN_PASSWORD && docker compose -f "$SCRIPT_DIR/docker-compose.yml" --env-file "$SCRIPT_DIR/.env.example" config >/dev/null 2>&1); then
  echo "ERROR: Compose unexpectedly accepted unedited .env.example with blank GRAFANA_ADMIN_PASSWORD" >&2
  exit 1
fi
echo "  [OK] Compose correctly rejected blank GRAFANA_ADMIN_PASSWORD"

echo "==> 2. Validating Prometheus configuration (rendered template)..."
sed "s|__GX10_METRICS_HOST__|ai.dustyway.org|g" \
  "$SCRIPT_DIR/prometheus/prometheus.yml.template" > "$RENDER_TMP/prometheus.yml"
docker run --rm \
  --entrypoint /bin/promtool \
  -v "$RENDER_TMP/prometheus.yml:/etc/prometheus/prometheus.yml:ro" \
  -v "$SCRIPT_DIR/prometheus/rules:/etc/prometheus/rules:ro" \
  prom/prometheus:v3.14.0 \
  check config /etc/prometheus/prometheus.yml

echo "==> 3. Validating Prometheus Alert Rules..."
docker run --rm \
  --entrypoint /bin/promtool \
  -v "$SCRIPT_DIR/prometheus/rules:/etc/prometheus/rules:ro" \
  prom/prometheus:v3.14.0 \
  check rules /etc/prometheus/rules/alerts.yml

echo "==> 4. Validating Alertmanager configuration..."
echo "https://hooks.slack.com/services/DUMMY/SECRET/WEBHOOK" > "$TEMP_SECRETS_DIR/slack_webhook"

docker run --rm \
  --entrypoint /bin/amtool \
  -v "$SCRIPT_DIR/alertmanager/alertmanager.yml:/etc/alertmanager/alertmanager.yml:ro" \
  -v "$TEMP_SECRETS_DIR/slack_webhook:/etc/alertmanager/secrets/slack_webhook:ro" \
  prom/alertmanager:v0.28.1 \
  check-config /etc/alertmanager/alertmanager.yml

echo "==> 5. Validating Grafana Provisioned Dashboards JSON..."
for dashboard in "$SCRIPT_DIR"/grafana/provisioning/dashboards/json/*.json; do
  if [ -f "$dashboard" ]; then
    node -e "JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'))" "$dashboard"
    echo "  [OK] $(basename "$dashboard")"
  fi
done

echo "==> 5b. Validating dashboard datasource UIDs match the provisioned datasource..."
node -e "
const fs = require('fs');
const ds = fs.readFileSync(process.argv[1], 'utf8');
const uid = (ds.match(/^\s*uid:\s*(\S+)/m) || [])[1];
if (!uid) { console.error('ERROR: no uid in datasource provisioning file'); process.exit(1); }
const dir = process.argv[2];
let bad = 0;
for (const f of fs.readdirSync(dir)) {
  if (!f.endsWith('.json')) continue;
  const text = fs.readFileSync(dir + '/' + f, 'utf8');
  const refs = [...text.matchAll(/\"uid\":\s*\"([^\"]+)\"/g)].map((m) => m[1]);
  const panelRefs = refs.filter((r) => r !== f.replace('.json', '') && !r.startsWith('nac-'));
  for (const r of panelRefs) {
    if (r !== uid) { console.error('ERROR: ' + f + ' references datasource uid ' + r + ', expected ' + uid); bad = 1; }
  }
}
if (bad) process.exit(1);
console.log('  [OK] all dashboard panels reference datasource uid ' + uid);
" "$SCRIPT_DIR/grafana/provisioning/datasources/prometheus.yaml" \
  "$SCRIPT_DIR/grafana/provisioning/dashboards/json"

echo "==> 6. End-to-end provisioning check (clean stack, Grafana + Prometheus APIs)..."
if [ ! -f "$SCRIPT_DIR/secrets/slack_webhook" ]; then
  mkdir -p "$SCRIPT_DIR/secrets"
  echo "https://hooks.slack.com/services/DUMMY/VALIDATE/WEBHOOK" > "$SCRIPT_DIR/secrets/slack_webhook"
  chmod 444 "$SCRIPT_DIR/secrets/slack_webhook"
  E2E_CREATED_SECRETS=1
fi
if ! docker network inspect notanothercards_default >/dev/null 2>&1; then
  docker network create notanothercards_default >/dev/null
  E2E_CREATED_NETWORK=1
fi

GRAFANA_ADMIN_PASSWORD="$E2E_GRAFANA_PASSWORD" \
POSTGRES_EXPORTER_DATA_SOURCE_NAME="postgresql://test:test@postgres:5432/notanothercards?sslmode=disable" \
GX10_METRICS_HOST="ai.dustyway.org" \
PROMETHEUS_PORT=9099 GRAFANA_PORT=3009 ALERTMANAGER_PORT=9097 NODE_EXPORTER_PORT=9109 POSTGRES_EXPORTER_PORT=9189 \
docker compose -p "$E2E_PROJECT" -f "$SCRIPT_DIR/docker-compose.yml" up -d --wait
E2E_STACK_UP=1

echo "  [OK] stack is healthy, checking provisioned resources..."

tries=30
while [ "$tries" -gt 0 ]; do
  if curl -sf http://127.0.0.1:3009/api/health >/dev/null 2>&1; then break; fi
  tries=$((tries - 1))
  sleep 5
done
curl -sf http://127.0.0.1:3009/api/health >/dev/null \
  || { echo "ERROR: Grafana API never became ready" >&2; exit 1; }
echo "  [OK] Grafana /api/health"

curl -sf -u "admin:$E2E_GRAFANA_PASSWORD" \
  http://127.0.0.1:3009/api/datasources/uid/Prometheus | grep -q '"uid":"Prometheus"' \
  || { echo "ERROR: provisioned Prometheus datasource (uid Prometheus) not found" >&2; exit 1; }
echo "  [OK] Grafana datasource uid Prometheus"

DASH_UIDS="$(curl -sf -u "admin:$E2E_GRAFANA_PASSWORD" 'http://127.0.0.1:3009/api/search?type=dash-db')"
for uid in nac-ai-queue nac-api-system nac-gx10-gpu; do
  echo "$DASH_UIDS" | grep -q "\"uid\":\"$uid\"" \
    || { echo "ERROR: provisioned dashboard $uid not found" >&2; exit 1; }
  echo "  [OK] Grafana dashboard $uid"
done

RULE_COUNT="$(curl -sf http://127.0.0.1:9099/api/v1/rules | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);const n=(j.data.groups||[]).reduce((a,g)=>a+(g.rules||[]).length,0);console.log(n)})")"
if [ "$RULE_COUNT" != "8" ]; then
  echo "ERROR: expected 8 Prometheus rules loaded, got $RULE_COUNT" >&2
  exit 1
fi
echo "  [OK] Prometheus loaded 8 alert rules"

curl -sf http://127.0.0.1:9097/-/healthy | grep -q "OK" \
  || { echo "ERROR: Alertmanager not healthy" >&2; exit 1; }
echo "  [OK] Alertmanager healthy"

GRAFANA_ADMIN_PASSWORD="$E2E_GRAFANA_PASSWORD" \
POSTGRES_EXPORTER_DATA_SOURCE_NAME="postgresql://test:test@postgres:5432/notanothercards?sslmode=disable" \
GX10_METRICS_HOST="ai.dustyway.org" \
PROMETHEUS_PORT=9099 GRAFANA_PORT=3009 ALERTMANAGER_PORT=9097 NODE_EXPORTER_PORT=9109 POSTGRES_EXPORTER_PORT=9189 \
docker compose -p "$E2E_PROJECT" -f "$SCRIPT_DIR/docker-compose.yml" \
  exec -T -u 65534 alertmanager cat /etc/alertmanager/secrets/slack_webhook >/dev/null \
  || { echo "ERROR: slack_webhook not readable by alertmanager (uid 65534)" >&2; exit 1; }
echo "  [OK] slack_webhook readable by alertmanager (uid 65534)"

echo "==> All monitoring infrastructure configurations validated successfully!"
