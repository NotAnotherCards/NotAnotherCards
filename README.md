_This project has been created as part of the 42 curriculum by amoiseik, dgomez-a, pschneid, samcasti, tpandya._

# NotAnotherCards

## Description

NotAnotherCards is a language-learning application built around smart flashcards and spaced repetition. It provides web and mobile apps with deck and card management, offline synchronisation, AI-assisted card generation, authentication, and learning statistics.

## Instructions

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) with Docker Compose, for the complete containerised application;
- [Node.js](https://nodejs.org/) 24 or newer and [pnpm](https://pnpm.io/) 11, for local development;
- PostgreSQL is started by Docker Compose; no separate local PostgreSQL installation is required.

### Run the complete app with Docker

From a fresh clone, start every required service with one command:

1. Copy the root environment example file:

   ```bash
   cp .env.example .env
   ```

2. Build and start all services, then wait until their health checks pass:

   ```bash
   docker compose up --build --wait
   ```

3. Open the application at <http://localhost:5173> and the public landing page at <http://localhost:5174>.

4. Optionally check that the landing container is healthy:

   ```bash
   curl --fail http://127.0.0.1:5174/health
   ```

The first run builds all images and applies database migrations automatically.

In production, the landing port is bound only to `127.0.0.1:5174` on the VPS. It is for the host Nginx proxy and must not be published directly to the internet.

> The AI gateway is optional, so leaving `AI_API_BASE` empty does not prevent the app from starting.

### Local development without app containers

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Copy the environment files:

   ```bash
   cp .env.example .env
   cd apps/api
   cp .env.example .env
   cd ../..
   ```

3. Replace the default values with your database credentials and the desired backend port.
4. Start the local database:

   ```bash
   docker compose up -d postgres
   ```

5. Apply the database migrations:

   ```bash
   pnpm --filter api db:migrate
   ```

   Without migrations, the database is empty and authentication requests fail.

6. Optionally configure Google sign-in by following the [OAuth setup guide](docs/oauth-setup.md).
7. Start the monorepo:

   ```bash
   pnpm dev
   ```

### Common commands

- `pnpm dev`: run the web and API development tasks through Turbo.
- `pnpm build`: build all packages and applications.
- `pnpm lint`: check the workspace for code-style problems.
- `pnpm test`: run the workspace test suites.
- `pnpm test:watch`: run tests again when supported files change.
- `pnpm format`: format Markdown and TypeScript files.
- Mobile app: see [docs/mobile.md](docs/mobile.md) for the Android emulator setup, the development build and release APKs.

## Resources

### Project references

Official documentation for the frameworks, libraries, and services used in the project:

| Area                                     | References                                                                                                                                                                                                                                                                                                                                                                                                      |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Language and runtime                     | [TypeScript](https://www.typescriptlang.org/docs/), [Node.js](https://nodejs.org/docs/latest-v24.x/api/)                                                                                                                                                                                                                                                                                                        |
| Web applications                         | [React](https://react.dev/learn), [Vite](https://vite.dev/guide/), [TanStack Router](https://tanstack.com/router/latest/docs/overview),                                                                                                                                                                                                                                                                         |
| Styling and UI components                | [Tailwind CSS](https://tailwindcss.com/docs), [shadcn/ui](https://ui.shadcn.com/docs)                                                                                                                                                                                                                                                                                                                           |
| Backend                                  | [NestJS](https://docs.nestjs.com/)                                                                                                                                                                                                                                                                                                                                                                              |
| Mobile application                       | [React Native](https://reactnative.dev/docs/getting-started), [Expo](https://docs.expo.dev/), [Expo Router](https://docs.expo.dev/router/introduction/), [NativeWind](https://www.nativewind.dev/), [React Native Reusables](https://reactnativereusables.com/)                                                                                                                                                 |
| Database and offline synchronisation     | [PostgreSQL](https://www.postgresql.org/docs/), [Drizzle ORM](https://orm.drizzle.team/docs/overview), [SQLite](https://www.sqlite.org/docs.html), [Expo SQLite](https://docs.expo.dev/versions/latest/sdk/sqlite/), [RemelonDB](https://github.com/dustyway/remelonDB/blob/main/docs/README.md)                                                                                                                |
| Authentication, validation, and forms    | [Better Auth](https://www.better-auth.com/docs/introduction), [Zod](https://zod.dev/), [React Hook Form](https://react-hook-form.com/get-started)                                                                                                                                                                                                                                                               |
| Internationalisation                     | [i18next](https://www.i18next.com/overview/getting-started), [react-i18next](https://react.i18next.com/)                                                                                                                                                                                                                                                                                                        |
| AI gateway and model hosting             | [LiteLLM](https://docs.litellm.ai/docs/)                                                                                                                                                                                                                                                                                                                                                                        |
| Email delivery and local testing         | [Nodemailer](https://nodemailer.com/), [Resend](https://resend.com/docs/introduction), [Mailpit](https://mailpit.axllent.org/docs/)                                                                                                                                                                                                                                                                             |
| Automated tests                          | [Vitest](https://vitest.dev/guide/), [Jest](https://jestjs.io/docs/getting-started), [Testing Library](https://testing-library.com/docs/), [React Native Testing Library](https://oss.callstack.com/react-native-testing-library/), [Playwright](https://playwright.dev/docs/intro), [Supertest](https://github.com/forwardemail/supertest)                                                                     |
| Monorepo tooling                         | [pnpm](https://pnpm.io/motivation), [Turborepo](https://turborepo.dev/docs)                                                                                                                                                                                                                                                                                                                                     |
| Code quality                             | [ESLint](https://eslint.org/docs/latest/), [Prettier](https://prettier.io/docs/), [Knip](https://knip.dev/), [Madge](https://github.com/pahen/madge)                                                                                                                                                                                                                                                            |
| Containers, deployment, and networking   | [Docker](https://docs.docker.com/), [Docker Compose](https://docs.docker.com/compose/), [Nginx](https://nginx.org/en/docs/), [Tailscale](https://tailscale.com/docs), [Headscale](https://headscale.net/stable/), [Certbot](https://certbot.eff.org/instructions)                                                                                                                                               |
| Monitoring and alerts                    | [Prometheus](https://prometheus.io/docs/introduction/overview/), [Grafana](https://grafana.com/docs/grafana/latest/), [Alertmanager](https://prometheus.io/docs/alerting/latest/alertmanager/), [Node Exporter](https://github.com/prometheus/node_exporter), [PostgreSQL Exporter](https://github.com/prometheus-community/postgres_exporter), [NVIDIA DCGM Exporter](https://github.com/NVIDIA/dcgm-exporter) |
| Version control, CI, and mobile releases | [Git](https://git-scm.com/doc), [GitHub Actions](https://docs.github.com/en/actions), [F-Droid](https://f-droid.org/docs/)                                                                                                                                                                                                                                                                                      |

### AI tools

The team used AI to assist with the tasks listed below. Each member reviewed and adapted AI-generated output before including it in the project.

<!-- Each team member records the AI tools they used and the exact task they supported. -->

| Tool                                               | Task supported                                                                                                                                                                                               | Used by   |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- |
| ChatGPT and Codex                                  | Code implementation, interface design, learning the JavaScript/TypeScript stack, and technical reference research.                                                                                           | @amoiseik |
| Codex CLI and Claude Code through T3 Code          | Implementation of offline synchronisation, web and mobile 2FA, gamification, and content moderation; assistance with tests, code review, and project documentation.                                          | @dgomez-a |
| ChatGPT and Gemini                                 | Code review, technical research and debugging.                                                                                                                                                               | @samcasti |
| opencode (free models)                             | API endpoints, continuous integration, VPS deployment, Prometheus and Grafana monitoring, and the two-factor authentication flow, using the Grafana, Prometheus, and Better Auth documentation as reference. | @tpandya  |
| Claude Code; opencode with ChatGPT and open models | Implementation help, tests, and code review for the mobile app, offline sync, content moderation, and the shared packages. Output was reviewed and adapted before use.                                       | @pschneid |

## Team Information

| Member    | Role and responsibility                                                                                                                                                                                                            |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| @amoiseik | Product Owner, Project Manager, and Developer; spaced repetition engine (scheduler and review queue); web UI; deck views; landing page.                                                                                            |
| @dgomez-a | Technical Lead and Developer; monorepo foundations; database schemas and offline synchronisation API; web and mobile security; shared activity rules and gamification backend; mobile review; deployment support and code reviews. |
| @samcasti | Developer; web frontend; artificial intelligence features; gamification.                                                                                                                                                           |
| @tpandya  | Project Manager and Developer; API foundations and authentication; continuous integration, deployment, infrastructure, and monitoring; two-factor authentication; artificial intelligence features.                                |
| @pschneid | Developer; mobile application; shared architecture; integration; artificial intelligence features.                                                                                                                                 |

## Project Management

The team uses GitHub Issues and GitHub Projects to organise tasks. Pull Requests are reviewed before merging into main. The team communicates in Slack and meets once a week online or in person at 42 when possible.

The complete working agreement, including branch and review rules, is in [Team agreements](docs/team_agreements.md). Meeting decisions are recorded in [project-management meeting notes](docs/project-management/meetings/).

## Technical Stack

| Area                         | Technology                                       | Why we use it                                                                                                                                                      |
| :--------------------------- | :----------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Web frontend                 | React, Vite, TypeScript, Tailwind CSS, shadcn/ui | React provides reusable components, Vite a fast development setup, and Tailwind with shadcn/ui consistent responsive UI.                                           |
| Backend                      | NestJS, TypeScript                               | NestJS provides a modular API structure, while TypeScript keeps contracts consistent with the frontend.                                                            |
| Authentication               | Better Auth                                      | Better Auth provides shared web and mobile authentication, session management, password recovery, social sign-in, and two-factor authentication with backup codes. |
| AI generation and moderation | LiteLLM, Ollama                                  | LiteLLM provides a common gateway for streamed and queued requests; Ollama hosts generation and moderation models for creating cards and checking shared content.  |
| Database                     | PostgreSQL, Drizzle ORM                          | PostgreSQL provides relational storage, while Drizzle adds typed schemas and queries in TypeScript.                                                                |
| Offline data                 | RemelonDB                                        | Keeps per-user learning data available offline on web and mobile and synchronises it through the API.                                                              |
| Mobile                       | Expo, React Native, expo-router, NativeWind      | Provides a native mobile app while reusing the project's React and TypeScript stack.                                                                               |
| Tests                        | Vitest, React Testing Library, Jest, Supertest   | Covers web components, backend code, and API behaviour.                                                                                                            |
| Tooling                      | pnpm, Turbo, Docker Compose, GitHub Actions      | Supports the monorepo, containerised development, and automated CI checks.                                                                                         |

## Database Schema

The application stores server data in PostgreSQL. A note holds learning content, cards generated from the note have their own learning schedules, decks group notes, and review events record answers. The web and mobile applications keep per-user local learning data for offline work and synchronise it with the API.

The diagram below shows the core account and learning tables with their key fields and data types. `PK` marks a primary key, `FK` a SQL foreign key, and `UK` a unique field.

```mermaid
erDiagram
    user ||--o| user_profiles : "has profile"
    user ||--o{ user_decks : owns
    user ||--o{ user_notes : owns
    user ||--o{ user_note_decks : owns
    user ||--o{ user_cards : owns
    user ||--o{ review_events : owns
    user_decks ||--o{ user_note_decks : contains
    user_notes ||--o{ user_note_decks : "belongs through"
    user_notes ||--o{ user_cards : generates
    user_cards ||--o{ review_events : "has review history"

    user {
        text id PK
        text email UK
        text name
        text timezone
        boolean two_factor_enabled
    }
    user_profiles {
        text user_id PK,FK
        text username UK
        text bio
        uuid native_language_id
        uuid target_language_id
    }
    user_decks {
        text id PK
        text user_id FK
        text title
        text note_type
        text visibility
    }
    user_notes {
        text id PK
        text user_id FK
        text note_type
        integer fields_version
        text fields_json "Serialized learning content"
    }
    user_note_decks {
        text id PK
        text user_id FK
        text note_id
        text deck_id
        boolean active
    }
    user_cards {
        text id PK
        text user_id FK
        text note_id
        text template_key
        text front "Markdown"
        text back "Markdown"
        double_precision due_at "Unix milliseconds"
        integer scheduled_interval_minutes
    }
    review_events {
        text id PK
        text user_id FK
        text user_card_id
        integer rating "1 to 4"
        double_precision reviewed_at "Unix milliseconds"
    }
```

For the complete details around the schemas, including authentication, AI, sharing, moderation, gamification, and sync bookkeeping tables, see [Database schemas](docs/db-schemas.md).

## Features List

<!-- Each feature must state what it does and who worked on it. -->

| Feature                               | What it does                                                                                                                                  | Contributors                                         |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Account management and social sign-in | Lets users register, sign in, keep a session, recover access, and use Google as a sign-in provider.                                           | @amoiseik; @dgomez-a; @samcasti; @tpandya; @pschneid |
| Two-factor authentication             | Lets users protect an account with time-based one-time passwords and backup codes.                                                            | @dgomez-a; @tpandya                                  |
| Password management and recovery      | Lets users reset a forgotten password by email and change their password while signed in.                                                     | @dgomez-a; @samcasti; @pschneid                      |
| User profile and preferences          | Lets users manage their profile, language, theme, and review preferences.                                                                     | @dgomez-a; @samcasti; @pschneid                      |
| Theme preferences                     | Lets users choose and retain a light or dark application theme.                                                                               | @samcasti; @pschneid                                 |
| Deck, note, and card management       | Lets a learner create, edit, organise, and delete decks, notes, and cards.                                                                    | @amoiseik; @dgomez-a; @samcasti; @tpandya; @pschneid |
| Starter sample decks                  | Provides ready-to-use learning decks that help a new learner begin studying.                                                                  | @amoiseik; @pschneid                                 |
| Word-note deck views                  | Displays word notes and their details in deck views, including compact counters, filtering, actions, and responsive layouts.                  | @amoiseik; @samcasti; @pschneid                      |
| Deck review session and answer modes  | Lets a learner start a deck-scoped review session, reveal cards, answer with ratings, use keyboard controls, and move through a review batch. | @amoiseik; @dgomez-a; @pschneid                      |
| Markdown card content                 | Renders formatted card fronts and backs on web and mobile, with shared validation for safe links and images.                                  | @dgomez-a; @samcasti                                 |
| Offline-first learning data           | Keeps each user's learning data locally available on web and mobile, then synchronises accepted changes with the API and PostgreSQL.          | @dgomez-a; @samcasti; @tpandya; @pschneid            |
| Community deck sharing                | Lets owners publish decks, lets learners import personal copies, and preserves ownership of an imported copy.                                 | @samcasti; @pschneid                                 |
| AI card generation                    | Creates card drafts from user input through queued generation jobs and a streamed web playground.                                             | @samcasti; @tpandya; @pschneid                       |
| AI content moderation                 | Checks published content, refuses unsafe content, supports reports and independent re-checks, and explains moderation decisions to owners.    | @dgomez-a; @pschneid                                 |
| Import and export                     | Exports learning data as JSON or CSV and imports validated data as one all-or-nothing operation.                                              | @samcasti                                            |
| Learning analytics                    | Shows due cards, dictionary size, review activity, streaks, forecasts, and card maturity, including while offline.                            | @dgomez-a; @samcasti; @pschneid                      |
| Gamification                          | Provides badges, global leaderboards, and daily challenges with persistent progress and feedback.                                             | @dgomez-a; @samcasti; @pschneid                      |
| Multiple languages                    | Provides a language switcher and translated user-facing text.                                                                                 | @amoiseik; @samcasti; @pschneid                      |
| Native mobile application             | Provides Android and iOS learning flows with local data, synchronisation, deck/card management, and review.                                   | @dgomez-a; @samcasti; @pschneid                      |
| Standalone landing application        | Provides a separate public marketing application, packaged with the project services and branded with the project identity.                   | @amoiseik; @tpandya                                  |
| Privacy Policy and Terms of Service   | Makes the required public legal information available from the landing application.                                                           | @amoiseik                                            |
| Production monitoring and alerts      | Collects infrastructure and application metrics, presents Grafana dashboards, and sends operational alerts to Slack.                          | @dgomez-a; @tpandya; @pschneid                       |

## Modules

The project claims the 13 modules below: four Major modules worth 2 points each and nine Minor modules worth 1 point each, for a total of 17 points. The 42 subject requires 14 points. The current point calculation and each module's requirement evidence are maintained in [Project requirements and progress](docs/requirements.md#4-claimed-modules).

<!-- Each module entry must explain its implementation, contributor(s), and justification where the subject requires one. -->

| Module                                                          | Points   | Implementation and justification                                                                                                                                                                                                                                                           | Contributors                                         |
| --------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| Web: framework for frontend and backend                         | Major, 2 | React implements the web client and NestJS implements the API.                                                                                                                                                                                                                             | @amoiseik; @dgomez-a; @samcasti; @tpandya; @pschneid |
| Web: ORM for the database                                       | Minor, 1 | Drizzle ORM defines the PostgreSQL schema and provides typed database queries.                                                                                                                                                                                                             | @dgomez-a; @samcasti; @tpandya; @pschneid            |
| Web: custom design system                                       | Minor, 1 | The web application has reusable UI components, a shared palette, typography, icons, and responsive layouts.                                                                                                                                                                               | @amoiseik; @samcasti; @pschneid                      |
| User Management: OAuth 2.0                                      | Minor, 1 | Google social sign-in is implemented through Better Auth and tested through the API.                                                                                                                                                                                                       | @amoiseik; @samcasti; @tpandya; @pschneid            |
| Artificial Intelligence: complete LLM system interface          | Major, 2 | Card-generation jobs accept user input, stream results in the web playground, record usage, and enforce quotas and rate limits.                                                                                                                                                            | @samcasti; @tpandya; @pschneid                       |
| Data and Analytics: data export and import                      | Minor, 1 | The application exports JSON and CSV, validates imports with Zod, and applies an import in one all-or-nothing database batch.                                                                                                                                                              | @samcasti                                            |
| Gaming and user experience: gamification                        | Minor, 1 | The system provides badges, global leaderboards, and daily challenges, with persistent storage, visual feedback, and clear progression rules.                                                                                                                                              | @dgomez-a; @samcasti; @pschneid                      |
| Modules of choice: mobile app                                   | Major, 2 | The native Expo and React Native application extends learning to Android and iOS with per-account offline data, synchronisation, route guards, review, and deck/card management. It addresses mobile offline use and shared-data synchronisation rather than wrapping the web application. | @dgomez-a; @samcasti; @pschneid                      |
| DevOps: monitoring with Prometheus and Grafana                  | Major, 2 | Prometheus collects API, PostgreSQL, VPS, GPU, and AI metrics; Grafana provides dashboards; Alertmanager sends alerts to Slack; Grafana is served through authenticated HTTPS access.                                                                                                      | @dgomez-a; @tpandya; @pschneid                       |
| User Management: user activity analytics and insights dashboard | Minor, 1 | Offline-capable statistics show due cards, dictionary size, streaks, review activity, forecasts, and card maturity from local learning data.                                                                                                                                               | @dgomez-a; @samcasti; @pschneid                      |
| Accessibility and Internationalization: multiple languages      | Minor, 1 | The application provides an internationalization system, at least three complete translations, a language switcher, and translatable user-facing text.                                                                                                                                     | @amoiseik; @samcasti; @pschneid                      |
| User Management: 2FA                                            | Minor, 1 | The application provides a complete two-factor authentication flow for users.                                                                                                                                                                                                              | @dgomez-a; @tpandya                                  |
| Artificial Intelligence: content moderation AI                  | Minor, 1 | Published content is classified before publication. Unsafe content is refused, reports trigger an independent re-check, and owners can inspect classifier verdicts and request an explanation.                                                                                             | @dgomez-a; @pschneid                                 |

## Individual Contributions

<!-- Each member adds their completed contribution and the technical or product challenge they addressed. -->

### @amoiseik

Product Owner and Developer. Defined the product scope, spaced repetition requirements, and review flow. Worked on the web UI, deck views, and landing page.
Challenge: Started without practical experience with JavaScript/TypeScript or collaborative GitHub workflows and learned the required stack and workflow while working on the project.

### @dgomez-a

Technical Lead and Developer. Set up the monorepo and worked on database schemas, offline synchronisation, web and mobile 2FA, gamification APIs, mobile reviews, and content moderation. Helped plan milestones and tickets, supported deployment, and reviewed code across the project.

A technical challenge was keeping data and account security consistent across the API, web, and mobile during offline use and synchronisation. Addressed this through shared validation rules, session guards, and integration tests.

### @samcasti

@samcasti is the main Frontend developer. He led the implementation of the core web dashboard, user profile and settings, bringing the user interface to life with a custom design system and reactive components. His major feature contributions include the gamification system (badges, leaderboards, and daily challenges), the Playground tab for AI-assisted card generation, the global internationalization (i18n) setup with multiple language translations, and the reactivity layer that drives the offline-first data synchronization and local database operations.

A significant technical challenge he addressed was ensuring the reliability of the UI and offline logic across different devices and scenarios.

### @tpandya

@tpandya handled the API, CI/CD, deployment, and monitoring. He implemented Better Auth, database schemas, AI job queues, Prometheus/Grafana monitoring, VPS deployment, HTTPS, and 2FA. He ensured reliability through automated validation scripts and end-to-end tests.

### @pschneid

Worked on the mobile app, offline sync, the AI gateway, content moderation, the shared packages, and the web deck views.

Challenge: learning had to work without internet on both the phone and the web, and both apps had to behave the same. Each app keeps the user's cards on the device, saves reviews there first, and syncs when the connection is back. If the same card was changed on two devices, the server decides which change is kept. The review rules and checks live in shared packages that both apps use, so they are written once.
