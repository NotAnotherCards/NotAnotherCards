*This project has been created as part of the 42 curriculum by amoiseik, dgomez-a, pschneid, samcasti, tpandya.*

# NotAnotherCards

## Description

NotAnotherCards is a language-learning application built around smart flashcards, context, nuance, and spaced repetition.

The project provides a web application, a mobile application, and an API. A learner can create and organise decks, study cards, and keep their learning data available offline. When a connection is available, the application synchronises accepted learning data with the server. The project also includes AI-assisted card generation, authentication, and learning statistics.

Key features include:

- user accounts, including Google sign-in;
- deck, note, card, and review management;
- offline-first learning data synchronisation between web, mobile, and API;
- AI-assisted card generation and content moderation;
- learning statistics and progress insights;
- a native mobile application for Android and iOS.

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

`--fail` makes `curl` return an error when the endpoint does not return a successful HTTP response. The first run builds the web, landing, and API images and applies database migrations automatically. `--build` rebuilds the images, and `--wait` returns only after health checks succeed.

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

## Resources

### Project references

- [42 Transcendence subject](docs/en.subject.pdf)
- [Project requirements and progress](docs/requirements.md)
- [Database documentation](docs/db-schemas.md)

### AI tools

<!-- Each team member records the AI tools they used and the exact task they supported. -->

| Tool | Task supported | Used by |
| --- | --- | --- |
| ChatGPT and Codex | Code implementation, interface design, learning the JavaScript/TypeScript stack, and technical reference research. AI output was reviewed and adapted before use. | @amoiseik |
| To be completed | To be completed | @dgomez-a |
| ChatGPT and Gemini | Code review, technical research and debugging. Output was reviewed and adapted before use. | @samcasti |
| opencode (free models) | API endpoints, continuous integration, VPS deployment, Prometheus and Grafana monitoring, and the two-factor authentication flow, using the Grafana, Prometheus, and Better Auth documentation as reference. AI output was reviewed and adapted before use. | @tpandya |
| To be completed | To be completed | @pschneid |

## Team Information

| Member | Role and responsibility |
| --- | --- |
| @amoiseik | Project founder; spaced repetition engine (scheduler and review queue); web UI; deck views; landing page. |
| @dgomez-a | Technical lead; database and schema; API and security; code reviews. |
| @samcasti | Web frontend; artificial intelligence features; gamification. |
| @tpandya | API foundations and authentication; continuous integration, deployment, infrastructure, and monitoring; two-factor authentication; artificial intelligence features. |
| @pschneid | Mobile application; shared architecture; integration; artificial intelligence features. |

Each member must review this row and correct it if it does not describe their actual responsibility.

## Project Management

The team tracks programming and non-programming work in GitHub Issues and uses GitHub Projects to organise the work. Pull Requests are reviewed before being merged into `main`. The team discusses work in Slack and meets in person at 42 when possible.

The complete working agreement, including branch and review rules, is in [Team agreements](docs/team_agreements.md). Meeting decisions are recorded in [project-management meeting notes](docs/project-management/meetings/).

## Technical Stack

| Area | Technology | Why we use it |
| --- | --- | --- |
| Web frontend | React, Vite, TypeScript, Tailwind CSS, shadcn/ui | React structures the interface as reusable components; Vite provides a fast development build; TypeScript checks data shapes before runtime; Tailwind and shadcn/ui provide consistent responsive interface building blocks. |
| Backend | NestJS, TypeScript | NestJS structures the HTTP API into modules and services, while TypeScript keeps contracts consistent with the frontend. |
| Database | PostgreSQL, Drizzle ORM | PostgreSQL stores persistent server data; Drizzle describes tables and queries in TypeScript while keeping database changes explicit. |
| Offline data | RemelonDB | Web and mobile keep a local per-user learning database and synchronise accepted changes through the API. |
| Mobile | Expo, React Native, expo-router, NativeWind | These tools let the project share the React and TypeScript approach while providing a native mobile interface. |
| Tests | Vitest, React Testing Library, Jest, Supertest | They test web components, backend code, and HTTP API behaviour. |
| Tooling | pnpm, Turbo, Docker Compose, GitHub Actions | pnpm manages dependencies; Turbo runs monorepo tasks; Docker Compose starts the services together; GitHub Actions runs automated checks. |

## Database Schema

The application stores server data in PostgreSQL. A note holds learning content, cards generated from the note have their own learning schedules, decks group notes, and review events record answers. The web and mobile applications keep per-user local learning data for offline work and synchronise it with the API.

For the complete table descriptions and relationship diagram, see [Database schemas](docs/db-schemas.md).

## Features List

<!-- Each feature must state what it does and who worked on it. -->

| Feature | What it does | Contributors |
| --- | --- | --- |
| Account management and social sign-in | Lets users register, sign in, keep a session, recover access, and use Google as a sign-in provider. | @amoiseik; @tpandya; @samcasti; other contributors to be completed by the team. |
| Two-factor authentication | Lets users protect an account with time-based one-time passwords and backup codes. | @tpandya; other contributors to be completed by the team. |
| Password management and recovery | Lets users reset a forgotten password by email and change their password while signed in. | @samcasti; other contributors to be completed by the team. |
| User profile and preferences | Lets users manage their profile, language, theme, and review preferences. | @samcasti; other contributors to be completed by the team. |
| Theme preferences | Lets users choose and retain a light or dark application theme. | @samcasti; other contributors to be completed by the team. |
| Deck, note, and card management | Lets a learner create, edit, organise, and delete decks, notes, and cards. | @samcasti; other contributors to be completed by the team. |
| Starter sample decks | Provides ready-to-use learning decks that help a new learner begin studying. | To be completed by the team. |
| Word-note deck views | Displays word notes and their details in deck views, including compact counters, filtering, actions, and responsive layouts. | @amoiseik; @samcasti |
| Deck review session and answer modes | Lets a learner start a deck-scoped review session, reveal cards, answer with ratings, use keyboard controls, and move through a review batch. | @amoiseik |
| Offline-first learning data | Keeps each user's learning data locally available on web and mobile, then synchronises accepted changes with the API and PostgreSQL. | @samcasti; other contributors to be completed by the team. |
| Community deck sharing | Lets owners publish decks, lets learners import personal copies, and preserves ownership of an imported copy. | @samcasti; other contributors to be completed by the team. |
| AI card generation | Creates card drafts from user input through queued generation jobs and a streamed web playground. | @tpandya; @samcasti; other contributors to be completed by the team. |
| AI content moderation | Checks published content, refuses unsafe content, supports reports and independent re-checks, and explains moderation decisions to owners. | To be completed by the team. |
| Import and export | Exports learning data as JSON or CSV and imports validated data as one all-or-nothing operation. | @samcasti |
| Learning analytics | Shows due cards, dictionary size, review activity, streaks, forecasts, and card maturity, including while offline. | To be completed by the team. |
| Gamification | Provides badges, global leaderboards, and daily challenges with persistent progress and feedback. |@samcasti; other contributors to be completed by the team. |
| Multiple languages | Provides a language switcher and translated user-facing text. | @samcasti; other contributors to be completed by the team. |
| Native mobile application | Provides Android and iOS learning flows with local data, synchronisation, deck/card management, and review. | To be completed by the team. |
| Standalone landing application | Provides a separate public marketing application, packaged with the project services and branded with the project identity. | @amoiseik |
| Privacy Policy and Terms of Service | Makes the required public legal information available from the landing application. | @amoiseik |
| Production monitoring and alerts | Collects infrastructure and application metrics, presents Grafana dashboards, and sends operational alerts to Slack. | @tpandya; other contributors to be completed by the team. |

## Modules

The project claims the 13 modules below: four Major modules worth 2 points each and nine Minor modules worth 1 point each, for a total of 17 points. The 42 subject requires 14 points. The current point calculation and each module's requirement evidence are maintained in [Project requirements and progress](docs/requirements.md#4-claimed-modules).

<!-- Each module entry must explain its implementation, contributor(s), and justification where the subject requires one. -->

| Module | Points | Implementation and justification | Contributors |
| --- | ---: | --- | --- |
| Web: framework for frontend and backend | Major, 2 | React implements the web client and NestJS implements the API. | @amoiseik, @samcasti, team |
| Web: ORM for the database | Minor, 1 | Drizzle ORM defines the PostgreSQL schema and provides typed database queries. | @tpandya, @samcasti, team |
| Web: custom design system | Minor, 1 | The web application has reusable UI components, a shared palette, typography, icons, and responsive layouts. | @amoiseik, @samcasti, team |
| User Management: OAuth 2.0 | Minor, 1 | Google social sign-in are implemented through Better Auth and tested through the API. | @amoiseik, @samcasti, team |
| Artificial Intelligence: complete LLM system interface | Major, 2 | Card-generation jobs accept user input, stream results in the web playground, record usage, and enforce quotas and rate limits. | @tpandya, @samcasti, team |
| Data and Analytics: data export and import | Minor, 1 | The application exports JSON and CSV, validates imports with Zod, and applies an import in one all-or-nothing database batch. | @samcasti |
| Gaming and user experience: gamification | Minor, 1 | The system provides badges, global leaderboards, and daily challenges, with persistent storage, visual feedback, and clear progression rules. | @samcasti |
| Modules of choice: mobile app | Major, 2 | The native Expo and React Native application extends learning to Android and iOS with per-account offline data, synchronisation, route guards, review, and deck/card management. It addresses mobile offline use and shared-data synchronisation rather than wrapping the web application. | To be completed by the team. |
| DevOps: monitoring with Prometheus and Grafana | Major, 2 | Prometheus collects API, PostgreSQL, VPS, GPU, and AI metrics; Grafana provides dashboards; Alertmanager sends alerts to Slack; Grafana is served through authenticated HTTPS access. | @tpandya, team |
| User Management: user activity analytics and insights dashboard | Minor, 1 | Offline-capable statistics show due cards, dictionary size, streaks, review activity, forecasts, and card maturity from local learning data. | @samcasti, team |
| Accessibility and Internationalization: multiple languages | Minor, 1 | The application provides an internationalization system, at least three complete translations, a language switcher, and translatable user-facing text. | @samcasti, team |
| User Management: 2FA | Minor, 1 | The application provides a complete two-factor authentication flow for users. | @tpandya, team |
| Artificial Intelligence: content moderation AI | Minor, 1 | Published content is classified before publication. Unsafe content is refused, reports trigger an independent re-check, and owners can inspect classifier verdicts and request an explanation. | To be completed by the team. |

## Individual Contributions

<!-- Each member adds their completed contribution and the technical or product challenge they addressed. -->

### @amoiseik

@amoiseik is the Product Owner and a developer. He established the project concept and early scope. He wrote the first spaced-repetition proposal and helped define the review flow. His implementation work includes the web deck review session and answer modes, word-note deck views, the standalone landing application and its brand assets, public legal pages, and Facebook sign-in configuration.

He started the project without practical experience in the JavaScript/TypeScript web stack or collaborative GitHub workflows. He used ChatGPT and Codex as learning and reference tools to understand the stack, team processes, and the code being changed, then reviewed and adapted the results before using them.

### @dgomez-a

To be completed.

### @samcasti

@samcasti is the main Frontend developer. He led the implementation of the core web dashboard, user profile and settings, bringing the user interface to life with a custom design system and reactive components. His major feature contributions include the gamification system (badges, leaderboards, and daily challenges), the Playground tab for AI-assisted card generation, the global internationalization (i18n) setup with multiple language translations, and the reactivity layer that drives the offline-first data synchronization and local database operations. 

A significant technical challenge he addressed was ensuring the reliability of the UI and offline logic across different devices and scenarios. 

### @tpandya

@tpandya handled the API, CI/CD, deployment, and monitoring. He implemented Better Auth, database schemas, AI job queues, Prometheus/Grafana monitoring, VPS deployment, HTTPS, and 2FA. He ensured reliability through automated validation scripts and end-to-end tests.

### @pschneid

To be completed.
