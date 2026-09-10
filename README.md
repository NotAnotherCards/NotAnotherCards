# NotAnotherCards

It's not another flashcard app. AI-powered language learning through context, nuance, and spaced repetition.

## Stack

- `apps/web`: React, Vite, TypeScript, Tailwind CSS, shadcn/ui, Vitest, and React Testing Library
- `apps/api`: NestJS, Drizzle ORM, PostgreSQL, Jest, and Supertest
- `apps/mobile`: Expo (React Native), expo-router, NativeWind, and jest-expo — see [docs/mobile.md](docs/mobile.md) for setup and running on Android/iOS
- `packages/*`: shared ESLint and TypeScript config packages
- `docker-compose.yml`: complete web, API, and PostgreSQL deployment

## Run the complete app with Docker

From a fresh clone, start every required service with one command:

1. Copy environment file

   root `.env.example` for Docker Compose:

```bash
  cp .env.example .env
```

2. Start all services with one command

```bash
docker compose up
```

3. Open http://localhost:5173

The first run builds the web and API images and applies database migrations automatically.

> The AI gateway is optional, so leaving `AI_API_BASE` empty does not prevent the app from starting.

## Local development without app containers

1. Install dependencies with `pnpm install`.
2. Copy environment files:

- root `.env.example` for Docker Compose

```bash
  cp .env.example .env
```

- `apps/api/.env.example` for the NestJS app

```bash
  cd apps/api
  cp .env.example .env
```

3. Replace the default values with your db credentials, and desired port for the backend
4. Start only the local database with `docker compose up -d postgres`.
5. Apply the database migrations with `pnpm --filter api db:migrate` (see [docs/database.md](docs/database.md)). Without this the database is empty and every auth request fails with a 500.
6. (Optional) Set up social login credentials for Google and Facebook by following the [OAuth Setup Guide](docs/oauth-setup.md).
7. Start the monorepo with `pnpm dev`.

## Common Commands

- `pnpm dev`: run the web and API dev tasks through Turbo
- `pnpm build`: build all packages and apps
- `pnpm lint`: lint the workspace
- `pnpm test`: run the workspace test suites
- `pnpm e2e`: run isolated browser tests (setup below)
- `pnpm test:watch`: run tests in watch mode where supported
- `pnpm format`: format Markdown and TypeScript files

## Browser tests

The #252 suite covers registration/onboarding, dashboard reload, deck and card
edits, review ratings and due-time boundaries, isolation and sync across three
browser contexts, account switching, word-note validation and optional-field
removal, and persisted Markdown XSS input. Playwright
runs the production web bundle in stable Google Chrome at desktop and phone
widths. The long-card layout also runs at 360×640, below the regular 390×844
phone viewport. Warnings, console errors, and uncaught browser exceptions fail
the test.

The scheduling scenario creates a card and reviews it, then uses Playwright's
browser clock to cross the five-minute and three-day due boundaries. It checks
the persisted schedule just before each boundary and automatic refresh at the
boundary, without waiting days or modifying stored due dates. This controls the
client clock, where review scheduling runs; server and authentication time stay
unchanged.

Start an empty, disposable database; each run creates fresh accounts:

```bash
docker run --detach --rm --name nac-browser-db \
  --publish 127.0.0.1:55432:5432 \
  --env POSTGRES_PASSWORD=browser-test-only postgres:18-alpine
export DATABASE_URL=postgresql://postgres:browser-test-only@localhost:55432/postgres
pnpm install --frozen-lockfile
pnpm --filter web exec playwright install --with-deps chrome
pnpm --filter api... build && pnpm --filter web... build
pnpm --filter api db:migrate
pnpm e2e
docker stop nac-browser-db
```

Wait for Postgres to accept connections before migrating. Do not use a database
containing data you want to keep. Stop the disposable container when finished,
including after a failed test run.

Playwright starts and stops the API on port 3000 and Vite preview on port 4173;
both ports must be free. Preview inherits Vite's `/api` and `/sync` proxies.
The harness supplies local auth settings and requires `DATABASE_URL` explicitly.
It does not use existing application servers. If Chrome is installed outside
its standard location, set `E2E_CHROME_EXECUTABLE` to its executable path.

Use `pnpm e2e --project=phone` for one viewport or `pnpm e2e --headed` to watch.
Tests live in `apps/web/e2e`, outside Vitest's `src` discovery. Import `test`
from `e2e/fixtures.ts`; use its `newContext` fixture for extra accounts so their
pages also participate in the console gate. Type-check with
`pnpm --filter web e2e:typecheck`.

Local contexts send distinct test client IP headers to avoid sharing Better
Auth's rate-limit bucket through the preview proxy. Rate limiting stays enabled;
this suite does not test its thresholds.

On failure, inspect `apps/web/playwright-logs` and run
`pnpm --filter web exec playwright show-report`. CI uploads the HTML report,
traces, screenshots, browser errors, and server logs as `browser-failure-evidence`.

The `Browser tests` workflow runs independently of the unit/API suites, using
its own Postgres service. It runs for pull requests and pushes to `main`, from
the Actions **Run workflow** button, and every day at 04:00 Europe/Berlin. It
currently uses API + Vite preview; Compose/nginx coverage remains with #251.
#318's browser regression creates long-front, long-back, both-long prose, and
six-item Markdown list cards at the 250-character-per-face limit. That base
heuristic keeps both compact answer-side cards readable at 360×640. The test
verifies the cards do not overlap or overflow and that every rating remains
inside the phone viewport. Agents can explore this disposable environment and
propose regression tests; CI executes reviewed, fixed assertions.
