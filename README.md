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
6. Start the monorepo with `pnpm dev`.

## Common Commands

- `pnpm dev`: run the web and API dev tasks through Turbo
- `pnpm turbo dev:mobile`: API + Metro in one terminal. Turbo swallows
  Expo's keyboard shortcuts, so when you need `a`/`r`, run
  `pnpm --filter api dev` and `pnpm --filter mobile start` in two
  terminals instead (see [docs/mobile.md](docs/mobile.md))
- `pnpm build`: build all packages and apps
- `pnpm lint`: lint the workspace
- `pnpm test`: run the workspace test suites
- `pnpm test:watch`: run tests in watch mode where supported
- `pnpm format`: format Markdown and TypeScript files
