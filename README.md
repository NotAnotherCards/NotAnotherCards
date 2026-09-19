# NotAnotherCards

It's not another flashcard app. AI-powered language learning through context, nuance, and spaced repetition.

Published community decks use automatic content moderation, user reporting,
automatic takedown after an independent two-classifier re-check, and an
operator takedown path. Owners see each classifier's verdict and any category
that classifier supplies, and can request a streamed contextual explanation. Personal copies already imported
from a community deck remain owned by the learner and are not altered by a
later takedown.

## Stack

- `apps/web`: React, Vite, TypeScript, Tailwind CSS, shadcn/ui, Vitest, and React Testing Library
- `apps/api`: NestJS, Drizzle ORM, PostgreSQL, Jest, and Supertest
- `apps/mobile`: Expo (React Native), expo-router, NativeWind, and jest-expo — see [docs/mobile.md](docs/mobile.md) for setup and running on Android/iOS
- `packages/*`: shared ESLint and TypeScript config packages
- `docker-compose.yml`: complete web, landing, API, and PostgreSQL deployment

## Run the complete app with Docker

From a fresh clone, start every required service with one command:

1. Copy environment file

   root `.env.example` for Docker Compose:

```bash
  cp .env.example .env
```

2. Build and start all services, then wait until their health checks pass

```bash
docker compose up --build --wait
```

3. Open the application at http://localhost:5173 and the public landing page
   at http://localhost:5174.

4. Check that the landing container is healthy:

```bash
curl --fail http://127.0.0.1:5174/health
```

`--fail` makes `curl` return an error when the endpoint does not return a
successful HTTP response.

The first run builds the web, landing, and API images and applies database
migrations automatically. `--build` rebuilds the images, and `--wait` returns
only after health checks succeed.

In production, the landing port is bound only to `127.0.0.1:5174` on the VPS.
It is for the host Nginx proxy and must not be published directly to the
internet.

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
- `pnpm test:watch`: run tests in watch mode where supported
- `pnpm format`: format Markdown and TypeScript files
