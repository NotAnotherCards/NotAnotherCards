# Continuous Integration (CI) Pipeline Documentation

This document serves as the guide for the **GitHub Actions Continuous Integration (CI)** pipeline configured in this monorepo. It outlines the architecture, optimization strategies, local replication procedures, and safety standards enforced by our pipeline.

---

## Overview

The primary objective of our CI pipeline is to act as a **quality gatekeeper** for our repository. Every pull request and direct push targeting our release/base branches must pass a series of automated checks before merging is permitted.

### The CI Pipeline Flow
```
[Developer Push / PR]
       │
       ▼
┌─────────────────────────┐
│  Trigger CI Workflow    │  ◄─── Automatic Stale Run Cancellation
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│   Setup Environment     │  ◄─── Node.js v22 & pnpm v11
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│     Restore Caches      │  ◄─── Restores pnpm store & Turborepo build cache
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│  pnpm install (frozen)  │  ◄─── Fast-installs from local cache store
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│      pnpm lint          │  ◄─── Concurrent ESLint across monorepo
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│      pnpm test          │  ◄─── Backend (Jest) & Frontend (Vitest) Unit Tests
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│      pnpm build         │  ◄─── TypeScript compile (type check) & bundler verification
└─────────────────────────┘
```

---

## Configuration Details (`.github/workflows/ci.yml`)

The pipeline runs on **Ubuntu Linux** (`ubuntu-latest`) using a single sequential job structure to maximize speed and efficiency while minimizing runner consumption.

### 1. Triggers
The workflow triggers automatically on:
- Any direct `push` to the `main` branch.
- Any `pull_request` targeting the `main` branch.

### 2. Concurrency Protection
To prevent burning valuable "CI minutes" on redundant builds, the pipeline implements automated concurrency cancellation:
```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```
If a developer pushes a new commit to a Pull Request while an existing CI pipeline is running, **the older run is cancelled immediately** to make room for the latest code.

---

## Caching & Performance Optimizations

Monorepos can suffer from slow build times. Our pipeline implements **two layers of caching** to ensure runs typically complete in under a minute.

### Layer 1: pnpm Global Store Cache
Instead of downloading node packages from the NPM registry on every build, we cache the global pnpm store:
- Enabled via the `cache: 'pnpm'` directive inside `actions/setup-node@v4`.
- **The Result:** Subsequent dependency installations resolve locally in **seconds** instead of minutes.

### Layer 2: Turborepo Local Artifact Caching
Turborepo automatically caches successful build outputs, typecheck structures, and testing logs in the local `.turbo/` folder.
We persist this directory across CI runs using `actions/cache@v4`:
```yaml
- name: Setup Turborepo Cache
  uses: actions/cache@v4
  with:
    path: .turbo
    key: ${{ runner.os }}-turbo-${{ github.sha }}
    restore-keys: |
      ${{ runner.os }}-turbo-
```
- **The Result:** When running `pnpm lint`, `pnpm test`, or `pnpm build`, Turborepo will check this folder. If a package's source code hasn't changed, Turborepo will skip the task entirely and replay cached logs in milliseconds.

---

## Managing Secrets and Environment Variables

### Build & Unit Tests
Our builds and unit tests are configured to run **without needing real production secrets**:
- **Type-checking/Bundling:** Compiling code (`tsc` and `vite build`) only verifies code structure and syntax; it does not connect to runtime APIs or services.
- **Unit Tests:** All unit/integration tests use mocks or local test files, meaning they do not connect to live databases (like PostgreSQL) or external authentication servers.

### Integration / E2E Tests (Future Reference)
If we write E2E or integration tests in the future that require real service connections, **never commit a `.env` file to Git.** 
Instead:
1. Define the variables as encrypted credentials in **GitHub Repository Secrets** (`Settings -> Secrets and variables -> Actions`).
2. Map the secrets to environment variables within your workflow step:
   ```yaml
   - name: Run E2E Tests
     run: pnpm test:e2e
     env:
       DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
   ```

---

## 🛠️ Testing Your Code Locally (Pre-Flight Checks)

To guarantee your PR will pass the CI pipeline cleanly, run these "Pre-Flight Checks" on your local machine before pushing:

### 1. The Lockfile Integrity Check
Ensure your lockfile is completely synchronised with your `package.json` dependencies:
```bash
pnpm install --frozen-lockfile
```

### 2. The Full Task Suite
Run the exact pipeline checks in your terminal:
```bash
pnpm lint && pnpm test && pnpm build
```
If all three pass locally, your code is guaranteed to pass successfully on the GHA runners.

---

## Enforcing the Pipeline (Branch Protection Rules)

To make this CI pipeline an un-bypassable gatekeeper, ensure the following GitHub settings are enabled on your repository:
1. Navigate to **Settings -> Branches** on GitHub.
2. Click **Add branch protection rule** for the `main` branch.
3. Enable **Require a pull request before merging** (forces branch-based development).
4. Enable **Require status checks to pass before merging**.
5. Search for and select the status check: **`run CI pipeline`**.
6. Enable **Require branches to be up to date before merging** (prevents conflicts).
7. Save changes.
