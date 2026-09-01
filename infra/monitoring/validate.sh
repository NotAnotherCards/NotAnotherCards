#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "==> 1. Validating monitoring Docker Compose configuration..."
GRAFANA_ADMIN_PASSWORD="ci-test-password" \
POSTGRES_EXPORTER_DATA_SOURCE_NAME="postgresql://test:test@postgres:5432/notanothercards?sslmode=disable" \
docker compose -f "$SCRIPT_DIR/docker-compose.yml" config --quiet

echo "==> 2. Validating Prometheus configuration..."
docker run --rm \
  --entrypoint /bin/promtool \
  -v "$SCRIPT_DIR/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro" \
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
TEMP_SECRETS_DIR="$(mktemp -d)"
trap 'rm -rf "$TEMP_SECRETS_DIR"' EXIT
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

echo "==> All monitoring infrastructure configurations validated successfully!"
