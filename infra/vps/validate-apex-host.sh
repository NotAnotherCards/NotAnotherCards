#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APEX_CONF="$SCRIPT_DIR/notanothercards.com.conf"
WWW_CONF="$SCRIPT_DIR/www.notanothercards.com.conf"
APP_CONF="$SCRIPT_DIR/app.notanothercards.com.conf"
GRAFANA_CONF="$SCRIPT_DIR/grafana.notanothercards.com.conf"

TEST_DIR="$(mktemp -d)"
CONF_DIR="$TEST_DIR/conf.d"
FIXTURES="$TEST_DIR/fixtures"
CONTAINER_NAME="nac-apex-nginx-validate-$$"

cleanup() {
  docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
  rm -rf "$TEST_DIR"
}
trap cleanup EXIT

fail() {
  echo "  [FAIL] $*" >&2
  docker logs "$CONTAINER_NAME" >&2 || true
  exit 1
}

require() {
  local file="$1"
  local pattern="$2"
  local message="$3"

  grep -Eq "$pattern" "$file" || {
    echo "  [FAIL] $message" >&2
    exit 1
  }
}

forbid() {
  local file="$1"
  local pattern="$2"
  local message="$3"

  if grep -Eq "$pattern" "$file"; then
    echo "  [FAIL] $message" >&2
    exit 1
  fi
}

echo "==> Validating apex host Nginx configuration..."

require "$APEX_CONF" 'server_name[[:space:]]+notanothercards\.com;' \
  "apex site must serve notanothercards.com"
require "$APEX_CONF" 'proxy_pass[[:space:]]+http://127\.0\.0\.1:5174;' \
  "apex site must proxy to the loopback landing container on 5174"
require "$APEX_CONF" 'listen[[:space:]]+80;' \
  "apex site must listen on IPv4 port 80"
require "$APEX_CONF" 'listen[[:space:]]+\[::\]:80;' \
  "apex site must listen on IPv6 port 80"
forbid "$APEX_CONF" '127\.0\.0\.1:(5173|3001)' \
  "apex site must not route to the web or grafana upstream"
forbid "$APEX_CONF" 'listen[[:space:]]+443' \
  "apex site must stay an HTTP bootstrap config; certbot adds TLS on the host"
forbid "$APEX_CONF" 'ssl_certificate' \
  "apex site must not ship certificate paths in the repository"

require "$WWW_CONF" 'server_name[[:space:]]+www\.notanothercards\.com;' \
  "www must have its own virtual host instead of falling through to the app"
require "$WWW_CONF" 'listen[[:space:]]+80;' \
  "www must listen on IPv4 port 80"
require "$WWW_CONF" 'listen[[:space:]]+\[::\]:80;' \
  "www must listen on IPv6 port 80"
require "$WWW_CONF" 'return 301 https://notanothercards\.com\$request_uri;' \
  "www must redirect directly to the apex, preserving the path and query"
forbid "$WWW_CONF" 'proxy_pass|ssl_certificate|listen[[:space:]]+443' \
  "www must stay a redirect-only HTTP bootstrap config; certbot adds TLS on the host"

require "$APP_CONF" 'server_name[[:space:]]+app\.notanothercards\.com;' \
  "app site must keep its server_name"
require "$APP_CONF" 'proxy_pass[[:space:]]+http://127\.0\.0\.1:5173;' \
  "app site must keep the web upstream on 5173"
require "$GRAFANA_CONF" 'server_name[[:space:]]+grafana\.notanothercards\.com;' \
  "grafana site must keep its server_name"
require "$GRAFANA_CONF" 'proxy_pass[[:space:]]+http://127\.0\.0\.1:3001;' \
  "grafana site must keep the grafana upstream on 3001"

echo "  [OK] apex, app, and grafana host configurations are wired to their own upstreams"

echo "==> Validating host Nginx configuration syntax..."
mkdir -p "$CONF_DIR" "$FIXTURES/landing" "$FIXTURES/web" "$FIXTURES/grafana"
cp "$APEX_CONF" "$WWW_CONF" "$APP_CONF" "$GRAFANA_CONF" "$CONF_DIR/"

# Model Certbot's installed TLS listener with a locally trusted test certificate.
# HTTPS requests must verify both the certificate and the www hostname.
openssl req -x509 -newkey rsa:2048 -nodes -days 1 \
  -subj '/CN=www.notanothercards.com' \
  -addext 'subjectAltName=DNS:www.notanothercards.com' \
  -keyout "$TEST_DIR/www.key" \
  -out "$TEST_DIR/www.crt" >/dev/null 2>&1
sed '/listen 80;/a\
  listen 443 ssl;\
  listen [::]:443 ssl;\
  ssl_certificate /etc/nginx/test/www.crt;\
  ssl_certificate_key /etc/nginx/test/www.key;\
' "$WWW_CONF" > "$CONF_DIR/$(basename "$WWW_CONF")"

# Test-only catch-all: the production VPS answers unmatched hostnames with a
# plain 404 instead of leaking them into a real virtual host.
printf '%s\n' \
  'server {' \
  '  listen 80 default_server;' \
  '  listen [::]:80 default_server;' \
  '  return 404;' \
  '}' \
  > "$CONF_DIR/00-test-default.conf"

# Test-only upstreams standing in for the three loopback containers. Each one
# echoes the headers it received so the assertions can prove the proxy chain.
upstream_server() {
  local port="$1"
  local site="$2"

  cat <<EOF
server {
  listen 127.0.0.1:${port};
  server_name _;
  root /fixtures/${site};
  index index.html;

  error_page 404 /index.html;
  add_header X-Upstream-Host \$host always;
  add_header X-Forwarded-Proto-Sent \$http_x_forwarded_proto always;

  # Same routing shape as landing.nginx.conf: only the known routes resolve.
  location = / {
    rewrite ^ /index.html last;
  }

  location = /privacy {
    try_files /privacy.html =404;
  }

  location / {
    try_files \$uri =404;
  }
}
EOF
}

{
  upstream_server 5174 landing
  upstream_server 5173 web
  upstream_server 3001 grafana
} > "$CONF_DIR/00-test-upstreams.conf"

printf '%s\n' '<!doctype html><body>nac-fixture-landing</body>' > "$FIXTURES/landing/index.html"
printf '%s\n' '<!doctype html><body>nac-fixture-landing-privacy</body>' > "$FIXTURES/landing/privacy.html"
printf '%s\n' '<!doctype html><body>nac-fixture-web</body>' > "$FIXTURES/web/index.html"
printf '%s\n' '<!doctype html><body>nac-fixture-grafana</body>' > "$FIXTURES/grafana/index.html"

docker run --rm \
  --volume "$CONF_DIR:/etc/nginx/conf.d:ro" \
  --volume "$TEST_DIR:/etc/nginx/test:ro" \
  nginx:1.28-alpine nginx -t

echo "  [OK] host Nginx configuration syntax"

echo "==> Validating host Nginx virtual host routing..."
docker run --detach --rm \
  --name "$CONTAINER_NAME" \
  --publish 127.0.0.1::80 \
  --publish 127.0.0.1::443 \
  --volume "$CONF_DIR:/etc/nginx/conf.d:ro" \
  --volume "$TEST_DIR:/etc/nginx/test:ro" \
  --volume "$FIXTURES:/fixtures:ro" \
  nginx:1.28-alpine >/dev/null

HOST_PORT="$(docker port "$CONTAINER_NAME" 80/tcp | awk -F: 'NR == 1 { print $NF }')"
TLS_PORT="$(docker port "$CONTAINER_NAME" 443/tcp | awk -F: 'NR == 1 { print $NF }')"
[[ -n "$HOST_PORT" ]] || fail "could not determine the temporary nginx port"
[[ -n "$TLS_PORT" ]] || fail "could not determine the temporary nginx TLS port"

for attempt in {1..20}; do
  status="$(curl --silent --noproxy '*' --output /dev/null --write-out '%{http_code}' \
    --resolve "notanothercards.com:$HOST_PORT:127.0.0.1" \
    "http://notanothercards.com:$HOST_PORT/" || true)"
  if [[ "$status" == "200" ]]; then
    break
  fi
  if [[ "$attempt" == "20" ]]; then
    fail "nginx test server did not become ready"
  fi
  sleep 0.25
done

request() {
  local name="$1"
  local host="$2"
  local path="$3"
  local expected_status="$4"
  local protocol="${5:-http}"
  local port="$HOST_PORT"
  local headers="$TEST_DIR/$name.headers"
  local body="$TEST_DIR/$name.body"
  local status

  if [[ "$protocol" == "https" ]]; then
    port="$TLS_PORT"
  fi

  if ! status="$(curl --silent --show-error --noproxy '*' \
    --cacert "$TEST_DIR/www.crt" \
    --output "$body" --dump-header "$headers" --write-out '%{http_code}' \
    --resolve "$host:$port:127.0.0.1" \
    "$protocol://$host:$port$path")"; then
    fail "$name: request failed"
  fi

  [[ "$status" == "$expected_status" ]] || fail "$name: expected HTTP $expected_status, got $status"
  RESPONSE_HEADERS="$headers"
  RESPONSE_BODY="$body"
}

assert_body_contains() {
  grep -Fq "$1" "$RESPONSE_BODY" || fail "$2"
}

assert_header_contains() {
  grep -Fqi "$1" "$RESPONSE_HEADERS" || fail "$2"
}

assert_body_lacks() {
  if grep -Fq "$1" "$RESPONSE_BODY"; then
    fail "$2"
  fi
}

request apex-home notanothercards.com / 200
assert_body_contains 'nac-fixture-landing' \
  "/: apex must be served by the landing upstream on 5174"
assert_header_contains 'X-Upstream-Host: notanothercards.com' \
  "/: apex must forward the original Host header"
assert_header_contains 'X-Forwarded-Proto-Sent: http' \
  "/: apex must forward X-Forwarded-Proto"

request apex-privacy notanothercards.com /privacy 200
assert_body_contains 'nac-fixture-landing-privacy' \
  "/privacy: apex must be served by the landing upstream on 5174"

request apex-not-found notanothercards.com /not-a-real-page 404

for protocol in http https; do
  for path in / '/privacy?source=www&lang=en' /login; do
    request "www-$protocol" www.notanothercards.com "$path" 301 "$protocol"
    # Compare the complete Location header so a dropped query, alternate host,
    # extra redirect hop, or login-page fallback cannot pass.
    location="$(tr -d '\r' < "$RESPONSE_HEADERS" | sed -n 's/^[Ll]ocation: //p')"
    [[ "$location" == "https://notanothercards.com$path" ]] \
      || fail "www over $protocol must redirect directly to https://notanothercards.com$path, got '$location'"
    assert_body_lacks 'nac-fixture-web' "www must not serve the application"
  done
done

request app-home app.notanothercards.com / 200
assert_body_contains 'nac-fixture-web' \
  "app.notanothercards.com must still use the web upstream on 5173"
assert_body_lacks 'nac-fixture-landing' \
  "app.notanothercards.com must not be routed to the landing upstream"

request grafana-home grafana.notanothercards.com / 200
assert_body_contains 'nac-fixture-grafana' \
  "grafana.notanothercards.com must still use the grafana upstream on 3001"
assert_body_lacks 'nac-fixture-landing' \
  "grafana.notanothercards.com must not be routed to the landing upstream"

request unknown-host unknown-host.example / 404
assert_body_lacks 'nac-fixture-landing' \
  "an unmatched hostname must not be proxied to the landing container"

echo "  [OK] apex routes to 127.0.0.1:5174; www redirects over HTTP and verified HTTPS; app and grafana keep their upstreams"
