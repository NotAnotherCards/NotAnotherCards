#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RENDER_TMP="$(mktemp -d)"

cleanup() {
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
