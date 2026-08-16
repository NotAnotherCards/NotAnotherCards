# VPS Hosting & Deployment Guide

This guide details the complete, reproducible setup for hosting **NotAnotherCards** on a Hetzner VPS (or any Linux VPS instance) using Docker Compose, Nginx, Certbot, and automated GitHub Actions deployment.

Topology & design details are described in [docs/deployment.md](../../docs/deployment.md).

---

## 1. Prerequisites & Host Software

Log into the VPS as root or a user with `sudo` privileges:

```bash
# Update package list and install baseline tools
sudo apt update && sudo apt install -y curl git nginx certbot python3-certbot-nginx

# Install Docker and Docker Compose plugin (if not already installed)
curl -fsSL https://get.docker.com | sh
sudo systemctl enable --now docker
```

---

## 2. Restricted Deploy User Setup

To follow the **principle of least privilege**, GitHub Actions does not connect as root or a personal user. Instead, create a dedicated `deploy` user:

```bash
# 1. Create system deploy user with bash shell
sudo useradd -m -s /bin/bash deploy

# 2. Add deploy user to the docker group so it can manage containers without sudo
sudo usermod -aG docker deploy

# 3. Create SSH directory for deploy user
sudo mkdir -p /home/deploy/.ssh
sudo chmod 700 /home/deploy/.ssh
```

### SSH Key Generation for CI/CD

On your local machine or server, generate a dedicated ed25519 keypair for deployment:

```bash
ssh-keygen -t ed25519 -C "deploy@notanothercards-ci" -f ./id_ed25519_deploy -N ""
```

1. Copy the public key content (`id_ed25519_deploy.pub`) to the VPS:
   ```bash
   sudo echo "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5..." >> /home/deploy/.ssh/authorized_keys
   sudo chmod 600 /home/deploy/.ssh/authorized_keys
   sudo chown -R deploy:deploy /home/deploy/.ssh
   ```
2. Save the private key (`id_ed25519_deploy`) securely — you will add this to GitHub Repository Secrets.

---

## 3. Directory Setup & Environment Configuration

Create the project deployment directory owned by `deploy`:

```bash
# Create target directory
sudo mkdir -p /opt/notanothercards
sudo chown -R deploy:deploy /opt/notanothercards

# Switch to deploy user and clone repository
sudo -u deploy git clone https://github.com/NotAnotherCards/NotAnotherCards.git /opt/notanothercards
cd /opt/notanothercards

# Create production environment file from template
cp .env.example .env
```

Edit `/opt/notanothercards/.env` to configure production secrets (PostgreSQL passwords, `BETTER_AUTH_SECRET`, domain URLs, and `AI_API_BASE` / `AI_API_KEY`).

---

## 4. Nginx & SSL Setup

Copy or symlink the Nginx site configuration template:

```bash
# Copy site config to Nginx conf.d or sites-available
sudo cp /opt/notanothercards/infra/vps/app.notanothercards.com.conf /etc/nginx/sites-available/app.notanothercards.com.conf
sudo ln -sf /etc/nginx/sites-available/app.notanothercards.com.conf /etc/nginx/sites-enabled/

# Request SSL Certificate using Certbot
sudo certbot --nginx -d app.notanothercards.com

# Test and reload Nginx
sudo nginx -t && sudo systemctl reload nginx
```

---

## 5. GitHub Repository Secrets & Environment

In your GitHub repository under **Settings -> Secrets and variables -> Actions**, configure the `production` environment with the following secrets:

| Secret Name       | Value Description                                                                                |
| ----------------- | ------------------------------------------------------------------------------------------------ |
| `SSH_HOST`        | IP address or domain of the VPS (e.g. `app.notanothercards.com`)                                 |
| `SSH_USER`        | `deploy`                                                                                         |
| `SSH_PRIVATE_KEY` | Contents of the `id_ed25519_deploy` private key file                                             |
| `SSH_FINGERPRINT` | Host key fingerprint of the VPS (e.g., from `ssh-keyscan -t ed25519 <host> \| ssh-keygen -lf -`) |

---

## 6. How Deployment Works

Every merge to `main` triggers `.github/workflows/deploy.yml`:

1. GitHub Actions connects to the VPS via SSH as the `deploy` user with host fingerprint validation.
2. Navigates to `/opt/notanothercards`.
3. Runs `git fetch origin main && git reset --hard origin/main` to sync latest code.
4. Executes `docker compose -f docker-compose.yml -f docker-compose.production.yml up -d --build --wait` to build and launch production-configured containers (with isolated internal DB ports and loopback-only service bindings).
5. Reloads host Nginx if needed.
