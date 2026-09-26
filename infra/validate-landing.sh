#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RENDER_TMP="$(mktemp -d)"
TEST_CONTAINER="notanothercards-landing-validation-$$"
TEST_SITE="$RENDER_TMP/landing-site"

cleanup() {
  docker rm --force "$TEST_CONTAINER" >/dev/null 2>&1 || true
  rm -rf "$RENDER_TMP"
}
trap cleanup EXIT

LOCAL_CONFIG="$RENDER_TMP/docker-compose.local.json"
PRODUCTION_CONFIG="$RENDER_TMP/docker-compose.production.json"

echo "==> Validating landing Compose configuration..."
LANDING_PORT=5174 docker compose \
  --project-directory "$REPO_ROOT" \
  --file "$REPO_ROOT/docker-compose.yml" \
  config --format json > "$LOCAL_CONFIG"

LANDING_PORT=5174 docker compose \
  --project-directory "$REPO_ROOT" \
  --file "$REPO_ROOT/docker-compose.yml" \
  --file "$REPO_ROOT/docker-compose.production.yml" \
  config --format json > "$PRODUCTION_CONFIG"

node - "$LOCAL_CONFIG" "$PRODUCTION_CONFIG" <<'NODE'
const fs = require('fs');

const [localPath, productionPath] = process.argv.slice(2);
const localConfig = JSON.parse(fs.readFileSync(localPath, 'utf8'));
const productionConfig = JSON.parse(fs.readFileSync(productionPath, 'utf8'));

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function getLanding(config, environment) {
  const landing = config.services?.landing;
  assert(landing, `${environment}: landing service is missing`);
  assert(
    landing.build?.target === 'landing',
    `${environment}: landing must use the Docker target named "landing"`,
  );
  assert(
    JSON.stringify(landing.healthcheck?.test) ===
      JSON.stringify([
        'CMD',
        'wget',
        '--quiet',
        '--spider',
        'http://127.0.0.1/health',
      ]),
    `${environment}: landing healthcheck must request /health inside the container`,
  );
  return landing;
}

function findLandingPort(landing, environment) {
  const port = landing.ports?.find(
    (candidate) =>
      String(candidate.target) === '80' && String(candidate.published) === '5174',
  );
  assert(port, `${environment}: landing must publish port 5174 to container port 80`);
  return port;
}

findLandingPort(getLanding(localConfig, 'local Compose'), 'local Compose');
const productionPort = findLandingPort(
  getLanding(productionConfig, 'production Compose'),
  'production Compose',
);
assert(
  productionPort.host_ip === '127.0.0.1',
  'production Compose: landing must bind only to 127.0.0.1',
);

console.log('  [OK] landing service, healthcheck, and production loopback binding');
NODE

echo "==> Validating landing Nginx configuration..."
docker run --rm \
  --interactive \
  nginx:1.28-alpine \
  sh -c 'cat > /etc/nginx/conf.d/default.conf && nginx -t' \
  < "$REPO_ROOT/landing.nginx.conf"

echo "  [OK] landing Nginx configuration syntax"

fail() {
  echo "  [FAIL] $*" >&2
  docker logs "$TEST_CONTAINER" >&2 || true
  exit 1
}

assert_header() {
  local headers="$1"
  local expected="$2"

  grep -Fqi "$expected" "$headers" || fail "missing header: $expected"
}

assert_security_headers() {
  local headers="$1"

  assert_header "$headers" "Content-Security-Policy: default-src 'self';"
  assert_header "$headers" "Permissions-Policy: camera=(), geolocation=(), microphone=()"
  assert_header "$headers" "Referrer-Policy: strict-origin-when-cross-origin"
  assert_header "$headers" "X-Content-Type-Options: nosniff"
  assert_header "$headers" "X-Frame-Options: DENY"
}

request() {
  local name="$1"
  local path="$2"
  local expected_status="$3"
  local headers="$RENDER_TMP/$name.headers"
  local body="$RENDER_TMP/$name.body"
  local status

  if ! status="$(curl --silent --show-error --output "$body" --dump-header "$headers" --write-out '%{http_code}' "$LANDING_URL$path")"; then
    fail "$name: request failed"
  fi

  [[ "$status" == "$expected_status" ]] || fail "$name: expected HTTP $expected_status, got $status"
  RESPONSE_HEADERS="$headers"
  RESPONSE_BODY="$body"
}

echo "==> Validating landing Nginx runtime behavior..."
mkdir -p "$TEST_SITE/assets"
printf '%s\n' '<!doctype html><html><body><div id="root"></div></body></html>' > "$TEST_SITE/index.html"
printf '%s\n' 'console.log("landing asset");' > "$TEST_SITE/assets/index-test.js"

docker run --detach --rm \
  --name "$TEST_CONTAINER" \
  --publish 127.0.0.1::80 \
  --volume "$REPO_ROOT/landing.nginx.conf:/etc/nginx/conf.d/default.conf:ro" \
  --volume "$TEST_SITE:/usr/share/nginx/html:ro" \
  nginx:1.28-alpine >/dev/null

LANDING_ADDRESS="$(docker port "$TEST_CONTAINER" 80/tcp | head -n 1)"
[[ -n "$LANDING_ADDRESS" ]] || fail "could not determine the temporary landing port"
LANDING_URL="http://$LANDING_ADDRESS"

for _ in $(seq 1 20); do
  if curl --silent --fail "$LANDING_URL/health" >/dev/null; then
    break
  fi
  sleep 1
done

request health /health 200
grep -Fxq 'ok' "$RESPONSE_BODY" || fail "/health: expected body 'ok'"
assert_security_headers "$RESPONSE_HEADERS"

request home / 200
grep -Fq '<!doctype html>' "$RESPONSE_BODY" || fail "/: expected landing HTML"
assert_header "$RESPONSE_HEADERS" 'Cache-Control: no-cache'
assert_security_headers "$RESPONSE_HEADERS"

request not-found /not-a-real-page 404
grep -Fq '<!doctype html>' "$RESPONSE_BODY" || fail "/not-a-real-page: expected landing HTML instead of the default Nginx error page"
grep -Fq '<div id="root"></div>' "$RESPONSE_BODY" || fail "/not-a-real-page: expected the React entry point"
assert_header "$RESPONSE_HEADERS" 'Cache-Control: no-cache'
assert_security_headers "$RESPONSE_HEADERS"

request asset /assets/index-test.js 200
assert_header "$RESPONSE_HEADERS" 'Cache-Control: public, max-age=31536000, immutable'
assert_security_headers "$RESPONSE_HEADERS"

echo "  [OK] landing health, 404, cache, and security headers"
