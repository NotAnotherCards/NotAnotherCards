#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

E2E_PROJECT="${MONITORING_VALIDATION_PROJECT:-nac-monitoring-validate}"
E2E_GRAFANA_PASSWORD="ci-validate-password"
E2E_SLACK_WEBHOOK_URL="http://slack-webhook-mock:8080/services/test"
E2E_CREATED_NETWORK=0
E2E_STACK_UP=0
RENDER_TMP="$(mktemp -d)"
TEMP_SECRETS_DIR="$(mktemp -d)"

cleanup() {
  if [ "$E2E_STACK_UP" = "1" ]; then
    GRAFANA_ADMIN_PASSWORD="$E2E_GRAFANA_PASSWORD" \
    POSTGRES_EXPORTER_DATA_SOURCE_NAME="postgresql://test:test@postgres:5432/notanothercards?sslmode=disable" \
    SLACK_WEBHOOK_URL="$E2E_SLACK_WEBHOOK_URL" \
    GX10_METRICS_MODE="proxy" \
    GX10_METRICS_HOST="ai.dustyway.org" \
    PROMETHEUS_PORT=9099 GRAFANA_PORT=3009 ALERTMANAGER_PORT=9097 NODE_EXPORTER_PORT=9109 POSTGRES_EXPORTER_PORT=9189 \
    docker compose --profile validation -p "$E2E_PROJECT" -f "$SCRIPT_DIR/docker-compose.yml" down -v --remove-orphans >/dev/null 2>&1 || true
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
SLACK_WEBHOOK_URL="$E2E_SLACK_WEBHOOK_URL" \
GX10_METRICS_MODE="proxy" \
GX10_METRICS_HOST="ai.dustyway.org" \
docker compose -f "$SCRIPT_DIR/docker-compose.yml" config --quiet

echo "==> 1b. Validating fail-safe empty password rejection..."
if (unset GRAFANA_ADMIN_PASSWORD && SLACK_WEBHOOK_URL="$E2E_SLACK_WEBHOOK_URL" docker compose -f "$SCRIPT_DIR/docker-compose.yml" --env-file "$SCRIPT_DIR/.env.example" config >/dev/null 2>&1); then
  echo "ERROR: Compose unexpectedly accepted unedited .env.example with blank GRAFANA_ADMIN_PASSWORD" >&2
  exit 1
fi
echo "  [OK] Compose correctly rejected blank GRAFANA_ADMIN_PASSWORD"

echo "==> 1c. Validating fail-safe empty Slack webhook rejection at startup..."
E2E_STACK_UP=1
if GRAFANA_ADMIN_PASSWORD="ci-test-password" \
  POSTGRES_EXPORTER_DATA_SOURCE_NAME="postgresql://test:test@postgres:5432/notanothercards?sslmode=disable" \
  SLACK_WEBHOOK_URL= \
  docker compose -p "$E2E_PROJECT" -f "$SCRIPT_DIR/docker-compose.yml" \
    run --rm --no-deps alertmanager >/dev/null 2>&1; then
  echo "ERROR: Alertmanager unexpectedly accepted blank SLACK_WEBHOOK_URL" >&2
  exit 1
fi
echo "  [OK] Alertmanager correctly rejected blank SLACK_WEBHOOK_URL"

echo "==> 2. Validating Prometheus configuration in proxy and tailnet modes..."
for gx10_mode in proxy tailnet; do
  if [ "$gx10_mode" = "proxy" ]; then
    gx10_host="ai.dustyway.org"
  else
    gx10_host="100.64.0.1"
  fi
  rendered_config="$RENDER_TMP/prometheus-$gx10_mode.yml"
  GX10_METRICS_MODE="$gx10_mode" GX10_METRICS_HOST="$gx10_host" \
    /bin/sh "$SCRIPT_DIR/prometheus/render-config.sh" \
    "$SCRIPT_DIR/prometheus/prometheus.yml.template" "$rendered_config"

  docker run --rm \
    --entrypoint /bin/promtool \
    -v "$rendered_config:/etc/prometheus/prometheus.yml:ro" \
    -v "$SCRIPT_DIR/prometheus/rules:/etc/prometheus/rules:ro" \
    prom/prometheus:v3.14.0 \
    check config /etc/prometheus/prometheus.yml

  if grep -q '__GX10_' "$rendered_config"; then
    echo "ERROR: unresolved GX10 placeholder in $gx10_mode configuration" >&2
    exit 1
  fi
done

grep -q "scheme: https" "$RENDER_TMP/prometheus-proxy.yml"
grep -q "targets: \['ai.dustyway.org'\]" "$RENDER_TMP/prometheus-proxy.yml"
grep -q "metrics_path: '/metrics'" "$RENDER_TMP/prometheus-tailnet.yml"
grep -q "targets: \['100.64.0.1:4000'\]" "$RENDER_TMP/prometheus-tailnet.yml"
grep -q "targets: \['100.64.0.1:9400'\]" "$RENDER_TMP/prometheus-tailnet.yml"
grep -q "targets: \['100.64.0.1:9100'\]" "$RENDER_TMP/prometheus-tailnet.yml"
echo "  [OK] proxy and direct-tailnet scrape endpoints render correctly"

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
  -v "$TEMP_SECRETS_DIR/slack_webhook:/run/secrets/slack_webhook:ro" \
  prom/alertmanager:v0.34.0 \
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

if rg -n ' or vector\(0\)' "$SCRIPT_DIR/grafana/provisioning/dashboards/json"; then
  echo "ERROR: dashboard uses an unmatched vector(0) fallback that adds a false zero series" >&2
  exit 1
fi
echo "  [OK] dashboard zero fallbacks preserve real labeled series without adding synthetic duplicates"

echo "==> 6. End-to-end provisioning check (clean control-plane stack, Grafana + Prometheus APIs)..."
if ! docker network inspect notanothercards_default >/dev/null 2>&1; then
  docker network create notanothercards_default >/dev/null
  E2E_CREATED_NETWORK=1
fi

E2E_STACK_UP=1
# node-exporter intentionally stays out of this cross-platform disposable
# stack because it mounts the host root and PID namespace. Its Compose config
# is checked above and production deployment requires its named target up.
GRAFANA_ADMIN_PASSWORD="$E2E_GRAFANA_PASSWORD" \
POSTGRES_EXPORTER_DATA_SOURCE_NAME="postgresql://test:test@postgres:5432/notanothercards?sslmode=disable" \
SLACK_WEBHOOK_URL="$E2E_SLACK_WEBHOOK_URL" \
GX10_METRICS_MODE="proxy" \
GX10_METRICS_HOST="ai.dustyway.org" \
PROMETHEUS_PORT=9099 GRAFANA_PORT=3009 ALERTMANAGER_PORT=9097 NODE_EXPORTER_PORT=9109 POSTGRES_EXPORTER_PORT=9189 \
docker compose --profile validation -p "$E2E_PROJECT" -f "$SCRIPT_DIR/docker-compose.yml" up -d --wait \
  prometheus grafana alertmanager postgres-exporter slack-webhook-mock

echo "  [OK] stack is healthy, checking provisioned resources..."

grafana_api() {
  local endpoint="$1"
  GRAFANA_ADMIN_PASSWORD="$E2E_GRAFANA_PASSWORD" \
  POSTGRES_EXPORTER_DATA_SOURCE_NAME="postgresql://test:test@postgres:5432/notanothercards?sslmode=disable" \
  SLACK_WEBHOOK_URL="$E2E_SLACK_WEBHOOK_URL" \
  GX10_METRICS_MODE="proxy" GX10_METRICS_HOST="ai.dustyway.org" \
  PROMETHEUS_PORT=9099 GRAFANA_PORT=3009 ALERTMANAGER_PORT=9097 NODE_EXPORTER_PORT=9109 POSTGRES_EXPORTER_PORT=9189 \
  docker compose --profile validation -p "$E2E_PROJECT" -f "$SCRIPT_DIR/docker-compose.yml" \
    exec -T grafana sh -ec '
      auth="$(printf "%s" "$GF_SECURITY_ADMIN_USER:$GF_SECURITY_ADMIN_PASSWORD" | base64 | tr -d "\n")"
      wget -qO- --header "Authorization: Basic $auth" "http://localhost:3000/$1"
    ' sh "$endpoint"
}

tries=30
while [ "$tries" -gt 0 ]; do
  if curl -sf http://127.0.0.1:3009/api/health >/dev/null 2>&1; then break; fi
  tries=$((tries - 1))
  sleep 5
done
curl -sf http://127.0.0.1:3009/api/health >/dev/null \
  || { echo "ERROR: Grafana API never became ready" >&2; exit 1; }
echo "  [OK] Grafana /api/health"

grafana_api api/datasources/uid/Prometheus | grep -q '"uid":"Prometheus"' \
  || { echo "ERROR: provisioned Prometheus datasource (uid Prometheus) not found" >&2; exit 1; }
echo "  [OK] Grafana datasource uid Prometheus"

grafana_api api/datasources/uid/Prometheus/health | grep -q '"status":"OK"' \
  || { echo "ERROR: provisioned Prometheus datasource health check failed" >&2; exit 1; }
echo "  [OK] Grafana can query the provisioned Prometheus datasource"

DASH_UIDS="$(grafana_api 'api/search?type=dash-db')"
for uid in nac-ai-queue nac-api-system nac-gx10-gpu; do
  echo "$DASH_UIDS" | grep -q "\"uid\":\"$uid\"" \
    || { echo "ERROR: provisioned dashboard $uid not found" >&2; exit 1; }
  echo "  [OK] Grafana dashboard $uid"
done

RULES_JSON="$(curl -sf http://127.0.0.1:9099/api/v1/rules)"
printf '%s' "$RULES_JSON" | node -e "
let s = '';
process.stdin.on('data', (d) => s += d).on('end', () => {
  const payload = JSON.parse(s);
  const actual = new Set((payload.data.groups || []).flatMap((g) => (g.rules || []).map((r) => r.name)));
  const expected = ['ApiDown', 'PostgresDown', 'LiteLlmGatewayDown', 'Gx10NodeExporterDown', 'Gx10GpuExporterDown', 'AiQueueDepthHigh', 'AiQueueDepthScrapeFailed', 'DiskFilling'];
  const missing = expected.filter((name) => !actual.has(name));
  if (missing.length) {
    console.error('ERROR: missing provisioned alert rules: ' + missing.join(', '));
    process.exit(1);
  }
  console.log('  [OK] Prometheus loaded all 8 named alert rules');
});
"

curl -sf http://127.0.0.1:9097/-/healthy | grep -q "OK" \
  || { echo "ERROR: Alertmanager not healthy" >&2; exit 1; }
echo "  [OK] Alertmanager healthy"

deliveries=0
echo "==> 7. Sending repeatable alerts through Alertmanager to the Slack-compatible mock..."
for expected_deliveries in 1 2; do
  curl -sf \
    -H 'Content-Type: application/json' \
    --data "[{\"labels\":{\"alertname\":\"MonitoringDeliverySmokeTest\",\"severity\":\"info\",\"smoke_id\":\"infra-validation-$expected_deliveries\"},\"annotations\":{\"summary\":\"CI delivery smoke test\"}}]" \
    http://127.0.0.1:9097/api/v2/alerts >/dev/null

  for _ in $(seq 1 30); do
    deliveries="$(
      GRAFANA_ADMIN_PASSWORD="$E2E_GRAFANA_PASSWORD" \
      POSTGRES_EXPORTER_DATA_SOURCE_NAME="postgresql://test:test@postgres:5432/notanothercards?sslmode=disable" \
      SLACK_WEBHOOK_URL="$E2E_SLACK_WEBHOOK_URL" \
      GX10_METRICS_MODE="proxy" GX10_METRICS_HOST="ai.dustyway.org" \
      PROMETHEUS_PORT=9099 GRAFANA_PORT=3009 ALERTMANAGER_PORT=9097 NODE_EXPORTER_PORT=9109 POSTGRES_EXPORTER_PORT=9189 \
      docker compose --profile validation -p "$E2E_PROJECT" -f "$SCRIPT_DIR/docker-compose.yml" \
        exec -T slack-webhook-mock wget -qO- http://127.0.0.1:8080/count
    )"
    [ "$deliveries" -ge "$expected_deliveries" ] && break
    sleep 1
  done
done

if [ "$deliveries" -ne 2 ]; then
  echo "ERROR: expected exactly two Slack webhook deliveries, got $deliveries" >&2
  exit 1
fi

curl -sf http://127.0.0.1:9097/metrics | awk '
  /^alertmanager_notifications_total\{/ && /integration="slack"/ && /receiver_name="slack-delivery-smoke"/ { attempted += $2 }
  /^alertmanager_notifications_failed_total\{/ && /integration="slack"/ && /receiver_name="slack-delivery-smoke"/ { failed += $2 }
  END { if (attempted != 2 || failed != 0) exit 1 }
' || { echo "ERROR: Alertmanager did not record two successful Slack notifications" >&2; exit 1; }
echo "  [OK] Alertmanager read the Compose secret and delivered both unique smoke alerts"

echo "==> All monitoring infrastructure configurations validated successfully!"
