#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_DIR="$(mktemp -d)"
CONTAINER_NAME="nac-ai-nginx-validate-$$"

cleanup() {
  docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
  rm -rf "$TEST_DIR"
}
trap cleanup EXIT

openssl req -x509 -newkey rsa:2048 -nodes -days 1 \
  -subj '/CN=ai.dustyway.org' \
  -keyout "$TEST_DIR/server.key" \
  -out "$TEST_DIR/server.crt" >/dev/null 2>&1

printf '%s\n' \
  'ssl_certificate /etc/nginx/test/server.crt;' \
  'ssl_certificate_key /etc/nginx/test/server.key;' \
  > "$TEST_DIR/00-test-tls.conf"

docker run --detach --rm \
  --name "$CONTAINER_NAME" \
  --publish 127.0.0.1::443 \
  --volume "$TEST_DIR:/etc/nginx/test:ro" \
  --volume "$TEST_DIR/00-test-tls.conf:/etc/nginx/conf.d/00-test-tls.conf:ro" \
  --volume "$SCRIPT_DIR/ai.dustyway.org.conf:/etc/nginx/conf.d/ai.dustyway.org.conf:ro" \
  nginx:1.28-alpine >/dev/null

HOST_PORT="$(docker port "$CONTAINER_NAME" 443/tcp | awk -F: 'NR == 1 { print $NF }')"
for attempt in {1..20}; do
  if curl --insecure --silent --noproxy '*' \
    --resolve "ai.dustyway.org:$HOST_PORT:127.0.0.1" \
    "https://ai.dustyway.org:$HOST_PORT/metrics" >/dev/null; then
    break
  fi
  if [ "$attempt" = "20" ]; then
    echo "ERROR: nginx test server did not become ready" >&2
    docker logs "$CONTAINER_NAME" >&2
    exit 1
  fi
  sleep 0.25
done

paths=(
  /metrics
  /metrics/
  /metrics/foo
  /metrics/a/b
  /dcgm/metrics
  /dcgm/metrics/foo
  /node/metrics
  /node/metrics/foo
)

for path in "${paths[@]}"; do
  status="$(curl --insecure --silent --output /dev/null --write-out '%{http_code}' \
    --noproxy '*' \
    --resolve "ai.dustyway.org:$HOST_PORT:127.0.0.1" \
    "https://ai.dustyway.org:$HOST_PORT$path")"
  if [ "$status" != "404" ]; then
    echo "ERROR: expected $path to return 404, got $status" >&2
    exit 1
  fi
done

echo "  [OK] public metrics endpoints and suffix paths return 404"
