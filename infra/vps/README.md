# Production VPS operations guide

NotAnotherCards production runs on our Ubuntu VPS at
<https://app.notanothercards.com>. The initial host, Docker, Nginx, TLS, DNS,
firewall, deployment user, and GitHub Actions setup are complete. This document
is the day-to-day guide for developers. The architecture is described
in [`docs/deployment.md`](../../docs/deployment.md).

## Environment inventory

| Item                 | Value                                                     |
| -------------------- | --------------------------------------------------------- |
| Public application   | `https://app.notanothercards.com`                         |
| VPS IPv4             | `169.58.127.208`                                          |
| VPS IPv6             | `2a02:c207:3020:2790::1`                                  |
| Production checkout  | `/opt/notanothercards`                                    |
| Runtime environment  | `/opt/notanothercards/.env`                               |
| Host Nginx site      | `/etc/nginx/sites-available/app.notanothercards.com.conf` |
| Compose files        | `docker-compose.yml` and `docker-compose.production.yml`  |
| Deployment account   | `deploy` (non-human, key-only)                            |
| GitHub environment   | `production`                                              |
| Public inbound ports | TCP 22, 80, and 443 only                                  |

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

## Production deployments

Production deployment is automated. A merge or direct push to `main` starts
`.github/workflows/deploy.yml`, which:

1. connects as `deploy` with host-fingerprint verification;
2. resets `/opt/notanothercards` to `origin/main`;
3. builds and starts both Compose files with `--wait`;
4. prints container status; and
5. verifies `https://app.notanothercards.com/health`.

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
curl --fail http://127.0.0.1:5173/health
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

Replace `api` with `web` or `postgres` as needed. Application deployments do
not reload host Nginx because its upstream remains `127.0.0.1:5173`.

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

- Certbot manages the installed TLS configuration and renewal timer. Check it
  periodically with `sudo certbot renew --dry-run`.
- Provider firewall and UFW allow public TCP 22, 80, and 443 only. Do not
  expose ports 3000, 5173, 5432, or branch-test ports publicly.
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
