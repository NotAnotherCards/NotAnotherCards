# Production VPS operations guide

NotAnotherCards production runs on our Ubuntu VPS at
<https://app.notanothercards.com>, with the public landing page at
<https://notanothercards.com>. The initial host, Docker, Nginx, TLS, DNS,
firewall, deployment user, and GitHub Actions setup are complete. This document
is the day-to-day guide for developers. The architecture is described
in [`docs/deployment.md`](../../docs/deployment.md).

## Environment inventory

| Item                 | Value                                                         |
| -------------------- | ------------------------------------------------------------- |
| Public application   | `https://app.notanothercards.com`                             |
| Public landing       | `https://notanothercards.com`                                 |
| Monitoring Grafana   | `https://grafana.notanothercards.com`                         |
| VPS IPv4             | `169.58.127.208`                                              |
| VPS IPv6             | `2a02:c207:3020:2790::1`                                      |
| Production checkout  | `/opt/notanothercards`                                        |
| Runtime environment  | `/opt/notanothercards/.env`                                   |
| Host Nginx site      | `/etc/nginx/sites-available/app.notanothercards.com.conf`     |
| Host Nginx landing   | `/etc/nginx/sites-available/notanothercards.com.conf`         |
| Host Nginx Grafana   | `/etc/nginx/sites-available/grafana.notanothercards.com.conf` |
| Compose files        | `docker-compose.yml` and `docker-compose.production.yml`      |
| Monitoring Compose   | `infra/monitoring/docker-compose.yml`                         |
| Deployment account   | `deploy` (non-human, key-only)                                |
| GitHub environment   | `production`                                                  |
| Public inbound ports | TCP 22, 80, and 443 only                                      |

PostgreSQL is reachable only inside its Compose network. The API and web
diagnostic ports bind to `127.0.0.1`; host Nginx is the only public application
entry point. Docker group membership is effectively root-level access and must
be treated as privileged.

## Access for a new maintainer

Every dev uses an individual Linux account and SSH key.

On the your computer:

```bash
ssh-keygen -t ed25519 -a 100 -C "GITHUB_USERNAME@notanothercards"
cat ~/.ssh/id_ed25519.pub
```

Send only the `.pub` value to an existing VPS administrator currently:

- @Danielg1406
- @tpandya42

The administrator creates the account and installs that key:

```bash
sudo adduser GITHUB_USERNAME
sudo usermod -aG sudo GITHUB_USERNAME
sudo install -d -m 700 -o GITHUB_USERNAME -g GITHUB_USERNAME \
  /home/GITHUB_USERNAME/.ssh
sudo tee /home/GITHUB_USERNAME/.ssh/authorized_keys >/dev/null <<'EOF'
PASTE_THE_DEVELOPER_PUBLIC_KEY
EOF
sudo chown GITHUB_USERNAME:GITHUB_USERNAME \
  /home/GITHUB_USERNAME/.ssh/authorized_keys
sudo chmod 600 /home/GITHUB_USERNAME/.ssh/authorized_keys
```

> Ask also the administrator to add you to the VPS Web Panel

Once the admin confirm the user creation, verify both SSH and sudo access:

```bash
ssh GITHUB_USERNAME@app.notanothercards.com
sudo whoami
```

The expected second result is `root`. Root SSH and SSH password authentication
remain disabled; the account password is used only for `sudo`.

## Secrets and ownership

- Runtime secrets live in `/opt/notanothercards/.env`, owned by `deploy` with
  mode `600`.
- Recovery copies live in the team password manager.
- `SSH_PRIVATE_KEY`, `SSH_HOST`, `SSH_USER`, and `SSH_FINGERPRINT` live in
  GitHub's protected `production` environment.
- Developers keep their own SSH private keys locally.

Check the runtime file without printing its contents:

```bash
sudo stat -c '%U %G %a %n' /opt/notanothercards/.env
sudo -u deploy grep -E '^[A-Z0-9_]+=' /opt/notanothercards/.env \
  | cut -d= -f1
```

Expected ownership and mode are `deploy deploy 600`.

## Tailnet access to the GX10

Production reaches the AI gateway and all three GX10 metrics endpoints directly
over the self-hosted tailnet. `ai.dustyway.org` remains available to teammates
with personal keys but is not in either production request path.

Get a single-use headscale pre-auth key from the tailnet administrator only
when you are ready to enrol the server. The key is delivered out of band and
expires 72 hours after it is minted. On the production VPS:

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up \
  --login-server https://headscale.dustyway.org \
  --authkey HEADSCALE_PRE_AUTH_KEY
tailscale status
```

The GX10 must appear as `gx10-536a` at `100.64.0.1`. Check whether the data
path is direct before changing production traffic:

```bash
tailscale ping 100.64.0.1
```

Do not treat an initial `via DERP(...)` line as failure: Tailscale starts over
DERP while attempting to establish a direct path. A successful direct-path
test stops after a line ending in `via <ip>:<port>`. If all attempts remain on
DERP and the command ends with `direct connection not established`, the path
is relayed and cancels the intended saving. See Tailscale's
[DERP troubleshooting guide](https://tailscale.com/docs/reference/troubleshooting/network-configuration/derp-routing).

Set these values in `/opt/notanothercards/.env`, without changing the existing
`AI_API_KEY` (`production-worker`):

```dotenv
AI_API_BASE=http://100.64.0.1:4000/v1
AI_DEFAULT_MODEL=gemma4
```

Keep `AI_API_BASE` without a trailing slash. Recreate the api container, then
submit one generation job through the production application and confirm that
it completes:

```bash
cd /opt/notanothercards
sudo -u deploy docker compose \
  -f docker-compose.yml \
  -f docker-compose.production.yml \
  up -d --no-deps --force-recreate api
```

Prometheus uses plain HTTP for the three tailnet-encrypted GX10 scrapes. Each
job keeps `metrics_path: /metrics` and uses its direct host and port:

```yaml
- job_name: litellm-gx10
  metrics_path: /metrics
  static_configs:
    - targets: [100.64.0.1:4000]

- job_name: node-gx10
  metrics_path: /metrics
  static_configs:
    - targets: [100.64.0.1:9100]

- job_name: dcgm-gpu-gx10
  metrics_path: /metrics
  static_configs:
    - targets: [100.64.0.1:9400]
```

There is no `scheme: https` and no trailing slash in `metrics_path`. Verify all
three endpoints from production and confirm their Prometheus targets are up:

```bash
curl --fail http://100.64.0.1:4000/metrics >/dev/null
curl --fail http://100.64.0.1:9100/metrics >/dev/null
curl --fail http://100.64.0.1:9400/metrics >/dev/null
```

No new public firewall rule is required: these services bind only to the GX10
tailnet address.

## Production deployments

Production deployment is automated. A merge or direct push to `main` starts
`.github/workflows/deploy.yml`, which:

1. connects as `deploy` with host-fingerprint verification;
2. resets `/opt/notanothercards` to `origin/main`;
3. builds and starts both Compose files with `--wait`;
4. prints container status;
5. verifies the monitoring stack, the Slack notification path, and every named
   Prometheus target; and
6. verifies the public endpoints: application and Grafana health, and the apex
   landing home page and `/privacy` over hostname-validated HTTPS, including a
   real HTTP 404 for an unknown path, the HTTP-to-HTTPS redirect, and the apex
   certificate.

Review deployment status under **GitHub → Actions → Continuous Deployment**.
Reverting a commit on `main` deploys the reverted source state.

> NOTE: Database schema migrations may not be reversible, so review migrations separately before calling a source revert a complete rollback.

Do not routinely deploy production by SSH. For an incident-only manual
redeployment of the already-reviewed `main` branch:

```bash
sudo -u deploy git -C /opt/notanothercards fetch origin main
sudo -u deploy git -C /opt/notanothercards reset --hard origin/main
cd /opt/notanothercards
sudo -u deploy docker compose \
  -f docker-compose.yml \
  -f docker-compose.production.yml \
  up -d --build --wait
curl --fail https://app.notanothercards.com/health
```

## Landing page at the apex domain

The public landing and legal pages are served at
<https://notanothercards.com>. The `landing` container publishes
`127.0.0.1:5174` only, so host Nginx is the sole public entry point; nothing
else may bind that port. The checked-in bootstrap configuration is
`infra/vps/notanothercards.com.conf`.

### DNS

Both address families must resolve to the VPS before Certbot can issue a
certificate, and both should keep resolving afterwards:

```bash
dig +short A    notanothercards.com   # 169.58.127.208
dig +short AAAA notanothercards.com   # 2a02:c207:3020:2790::1
curl -4 -sS -o /dev/null -w '%{http_code}\n' http://notanothercards.com/
curl -6 -sS -o /dev/null -w '%{http_code}\n' http://notanothercards.com/
```

`www.notanothercards.com` resolves to the same VPS but is deliberately not
served; it must keep returning 404.

### Installing the host site

Run from the production checkout. On a host that has no Nginx yet, install it
first:

```bash
sudo apt-get update
sudo apt-get install nginx certbot python3-certbot-nginx

cd /opt/notanothercards
sudo cp infra/vps/notanothercards.com.conf /etc/nginx/sites-available/
sudo ln -sf /etc/nginx/sites-available/notanothercards.com.conf \
           /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

Do not copy the file again after the next step: Certbot rewrites the installed
copy to add TLS and the HTTP-to-HTTPS redirect, and re-copying it would remove
them.

### Issuing the certificate

```bash
sudo certbot --nginx -d notanothercards.com
sudo certbot certificates
sudo certbot renew --dry-run
```

Certbot edits `/etc/nginx/sites-available/notanothercards.com.conf` in place
and reloads Nginx. The other virtual hosts are untouched.

### Health checks

```bash
curl --fail https://notanothercards.com/
curl --fail https://notanothercards.com/privacy
curl -o /dev/null -w '%{http_code} %{redirect_url}\n' http://notanothercards.com/
curl -o /dev/null -w '%{http_code}\n' https://notanothercards.com/not-a-real-page
echo | openssl s_client -connect 127.0.0.1:443 -servername notanothercards.com 2>/dev/null \
  | openssl x509 -noout -ext subjectAltName
```

Expected: two `200`s, `301 https://notanothercards.com/`, `404`, and a
certificate whose subject alternative name lists `DNS:notanothercards.com`.
The same checks run automatically after every deployment.

### Troubleshooting

```bash
sudo nginx -t
sudo systemctl status nginx --no-pager
sudo journalctl -u nginx --no-pager -n 50
sudo certbot certificates
sudo -u deploy docker compose \
  -f docker-compose.yml \
  -f docker-compose.production.yml ps
curl --fail http://127.0.0.1:5174/health
ss -ltnp | grep 5174
```

`ss` must show `127.0.0.1:5174` and never `0.0.0.0:5174` or `[::]:5174`. If
HTTPS fails while HTTP works, the certificate is missing or expired; if both
fail, the site is not enabled or the container is down.

### Rollback

Remove the public landing route and its certificate:

```bash
sudo rm /etc/nginx/sites-enabled/notanothercards.com.conf
sudo nginx -t && sudo systemctl reload nginx
sudo certbot delete --cert-name notanothercards.com
```

Then revert the deployment smoke-check commit that requires the apex endpoint,
otherwise the next deployment fails its verification step.

## Production checks and logs

```bash
cd /opt/notanothercards

sudo -u deploy docker compose \
  -f docker-compose.yml \
  -f docker-compose.production.yml ps

sudo -u deploy docker compose \
  -f docker-compose.yml \
  -f docker-compose.production.yml logs --tail=200

curl --fail https://app.notanothercards.com/health
curl --fail https://notanothercards.com/
curl --fail https://notanothercards.com/privacy
curl --fail http://127.0.0.1:5173/health
curl --fail http://127.0.0.1:5174/health
sudo nginx -t
sudo systemctl status nginx --no-pager
sudo certbot certificates
df -h
free -h
```

Follow one service's logs during an incident:

```bash
sudo -u deploy docker compose \
  -f /opt/notanothercards/docker-compose.yml \
  -f /opt/notanothercards/docker-compose.production.yml \
  logs --follow --tail=200 api
```

Replace `api` with `web`, `landing`, or `postgres` as needed. Application
deployments do not reload host Nginx because its upstreams remain
`127.0.0.1:5173` and `127.0.0.1:5174`.

## Testing a branch without replacing production

Never switch `/opt/notanothercards` away from `main` to test a branch. Run a
separate Compose project with separate loopback ports, database volume, working
tree, and non-production secrets. Only run reviewed team branches: Docker build
access is privileged and branch code must be treated accordingly.

Coordinate port assignments with the team. The example below uses PR 123,
API port 13000, and web port 15173.

Create an isolated worktree:

```bash
sudo install -d -m 755 -o deploy -g deploy /opt/notanothercards-tests
sudo -u deploy git -C /opt/notanothercards fetch origin BRANCH_NAME
sudo -u deploy git -C /opt/notanothercards worktree add \
  /opt/notanothercards-tests/pr-123 origin/BRANCH_NAME
```

Create a separate environment file. Do not copy production `.env`:

```bash
sudo install -m 600 -o deploy -g deploy \
  /opt/notanothercards-tests/pr-123/.env.example \
  /opt/notanothercards-tests/pr-123/.env
sudo -u deploy nano /opt/notanothercards-tests/pr-123/.env
```

Use unique ports and test-only secrets:

```dotenv
WEB_PORT=15173
API_PORT=13000
POSTGRES_PORT=15432

POSTGRES_USER=notanothercards_test
POSTGRES_PASSWORD=REPLACE_WITH_TEST_ONLY_SECRET
POSTGRES_DB=notanothercards_test
DATABASE_URL=postgresql://notanothercards_test:REPLACE_WITH_THE_SAME_SECRET@postgres:5432/notanothercards_test

BETTER_AUTH_SECRET=REPLACE_WITH_TEST_ONLY_SECRET
BETTER_AUTH_URL=http://localhost:15173
FRONTEND_URL=http://localhost:15173

AI_API_BASE=
AI_API_KEY=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
FACEBOOK_CLIENT_ID=
FACEBOOK_CLIENT_SECRET=
```

Start the isolated stack with a unique Compose project name:

```bash
cd /opt/notanothercards-tests/pr-123
sudo -u deploy env COMPOSE_PROJECT_NAME=nac-pr-123 docker compose \
  -f docker-compose.yml \
  -f docker-compose.production.yml \
  up -d --build --wait

sudo -u deploy env COMPOSE_PROJECT_NAME=nac-pr-123 docker compose \
  -f docker-compose.yml \
  -f docker-compose.production.yml ps
curl --fail http://127.0.0.1:15173/health
```

Access it from your computer without opening another public port:

```bash
ssh -L 15173:127.0.0.1:15173 \
  GITHUB_USERNAME@app.notanothercards.com
```

Keep that SSH session open and visit <http://localhost:15173>. Test relevant
browser flows and inspect logs on the VPS. If the tunnel is refused, SSH local
forwarding is disabled for that account; ask an administrator to review the
SSH policy instead of opening the test port in either firewall.

Remove the test stack and its database volume when finished. Confirm the path
and project name before running these commands:

```bash
cd /opt/notanothercards-tests/pr-123
sudo -u deploy env COMPOSE_PROJECT_NAME=nac-pr-123 docker compose \
  -f docker-compose.yml \
  -f docker-compose.production.yml \
  down --volumes --remove-orphans
cd /opt/notanothercards
sudo -u deploy git worktree remove /opt/notanothercards-tests/pr-123
```

Verify production remained healthy:

```bash
curl --fail https://app.notanothercards.com/health
sudo -u deploy docker compose \
  -f /opt/notanothercards/docker-compose.yml \
  -f /opt/notanothercards/docker-compose.production.yml ps
```

## Certificate, firewall, and backup responsibilities

- Certbot manages the installed TLS configuration and renewal timer, covering
  `app.notanothercards.com`, `grafana.notanothercards.com`, and
  `notanothercards.com`. Check it periodically with `sudo certbot renew --dry-run`.
- Provider firewall and UFW allow public TCP 22, 80, and 443 only. Do not
  expose ports 3000, 5173, 5174, 5432, or branch-test ports publicly.
- Docker volumes provide persistence, not backups. Keep encrypted PostgreSQL
  backups outside the VPS and periodically test restoration.

## User deletion

Remove access when somebody leaves the team:

```bash
sudo deluser GITHUB_USERNAME sudo
sudo usermod --lock GITHUB_USERNAME
```

Also remove that person from the VPS provider, password-manager vault, GitHub
environment reviewers.
