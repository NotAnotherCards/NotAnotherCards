# NotAnotherCards

It's not another flashcard app. AI-powered language learning through context, nuance, and spaced repetition.

## Stack

- `apps/web`: React, Vite, TypeScript, Tailwind CSS, shadcn/ui, Vitest, and React Testing Library
- `apps/api`: NestJS, Drizzle ORM, PostgreSQL, Jest, and Supertest
- `packages/*`: shared ESLint and TypeScript config packages
- `docker-compose.yml`: local PostgreSQL service for development

## Setup

1. Install dependencies with `pnpm install`.
2. Copy environment files:

```bash
  cp .env.example .env
```

- root `.env.example` for Docker Compose
- `apps/api/.env.example` for the NestJS app

3. Start the local database with `docker compose up -d`.
4. Start the monorepo with `pnpm dev`.

## Common Commands

- `pnpm dev`: run the web and API dev tasks through Turbo
- `pnpm build`: build all packages and apps
- `pnpm lint`: lint the workspace
- `pnpm test`: run the workspace test suites
- `pnpm test:watch`: run tests in watch mode where supported
- `pnpm format`: format Markdown and TypeScript files
