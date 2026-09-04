# Requirements and progress

Source: `docs/en.subject.pdf`, version 21.2. This file gives the requirements
in short sentences, close to the subject text, and a progress estimate for
each one. The subject is the reference. If the two disagree, the subject is
correct.

To refresh after a subject update: `pdftotext docs/en.subject.pdf - | diff`
against the previous version, then change only the lines that changed.

Status values:

- **done**: merged on `main`, with the evidence given.
- **in review**: a PR is open.
- **in progress**: an issue is assigned and work has started.
- **planned**: an issue or a design exists, no code.
- **not started**: nothing exists.
- **gap**: mandatory, missing, and the subject says it causes rejection.

Progress (2026-09-03): **13 modules, 17 points claimed** (Public API and PWA
at very low priority and not counted in the 17, advanced search open and not
counted; see section 6). By module: done 3
(4 pts), in review 2 (3 pts), in progress 4 (6 pts), not started 4 (4 pts).
Weighted by points, about **50%** of the claimed 17 points is done. Two
mandatory gaps (Privacy and Terms pages, README first line) and the README
sections, which are at about 15%.

How the percentages are made: a module's figure is the share of its subject
bullets that are met; a partly met bullet gets partial credit, stated in its
line. A table row is 100 or 0, or a hand estimate where work is partial. They
are estimates, not measurements; the evidence column is what to check.

## 1. General requirements (subject III.2)

The subject says the project is rejected if one of these is not met.

| Requirement                                                                                                                                                                                                                                                                                                       | Status            |   % | Evidence                                                                               |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | --: | -------------------------------------------------------------------------------------- |
| The project must be a web application. It must have a frontend, a backend, and a database.                                                                                                                                                                                                                        | done              | 100 | `apps/web`, `apps/api`, PostgreSQL in `docker-compose.yml`                             |
| The team must use Git. Commit messages must be clear. The repository must show commits from all team members and a proper distribution of work.                                                                                                                                                                   | done              | 100 | 10 authors on `main` (`git shortlog -sn`)                                              |
| Deployment must use containers (Docker or equivalent). It must start with one command.                                                                                                                                                                                                                            | done              | 100 | `docker compose up`, `README.md`                                                       |
| The website must work with the latest stable Google Chrome.                                                                                                                                                                                                                                                       | not verified      |  90 | no evidence recorded                                                                   |
| No warnings or errors about the JavaScript code may appear in the browser console. (Changed in 21.2: only JavaScript warnings and errors count.)                                                                                                                                                                  | not verified      |  70 | A21 in the plan                                                                        |
| The project must include a Privacy Policy page and a Terms of Service page. The pages must be easy to reach, for example from a footer. They must have relevant content. They must not be empty or placeholders.                                                                                                  | **gap**           |   0 | no such page in `apps/web/src`                                                         |
| The website must support multiple users at the same time. Users must be able to work at the same time without conflicts or performance problems. Concurrent actions must be handled correctly. Real-time updates must reach all connected users when applicable. No data corruption or race conditions may occur. | done, with a note |  90 | per-user databases and sync (#151, #177); updates arrive on sync triggers, not by push |

## 2. Technical requirements (subject III.3)

| Requirement                                                                                                                                               | Status      |   % | Evidence                                                     |
| --------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | --: | ------------------------------------------------------------ |
| The frontend must be clear, responsive, and accessible on all devices.                                                                                    | in progress |  60 | A15, A16 in the plan                                         |
| Use a CSS framework or a styling solution.                                                                                                                | done        | 100 | Tailwind CSS                                                 |
| Store credentials in a local `.env` file that Git ignores. Supply an `.env.example` file.                                                                 | done        | 100 | `apps/api/.env.example`, `.gitignore`                        |
| The database must have a clear schema and well-defined relations.                                                                                         | done        | 100 | `docs/db-schemas.md`                                         |
| The application must have basic user management. Users must sign up and log in securely. At minimum: email and password with hashed and salted passwords. | done        | 100 | Better Auth, `apps/api/src/auth`                             |
| All forms and user inputs must be validated in the frontend and in the backend.                                                                           | done        | 100 | Zod schemas in `@repo/schemas`, used by web, mobile, and api |
| Every connection to the backend from a browser, a script, or an external API must use HTTPS. Connections inside the backend can be without encryption.    | done        | 100 | nginx TLS on the VPS, `docs/deployment.md`                   |

## 3. README requirements (subject, "Readme Requirements")

The subject says the README is a critical part of the evaluation.

| Requirement                                                                                                                                             | Status      |   % | Evidence                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | --: | ------------------------------------------------------------------------------------------- |
| The first line must be in italics and read: _This project has been created as part of the 42 curriculum by <login1>, <login2>, ..._                     | **gap**     |   0 | first line is `# NotAnotherCards`                                                           |
| A "Description" section: the project name, its goal, an overview, and the key features.                                                                 | not started |   0 | none                                                                                        |
| An "Instructions" section: prerequisites, `.env` setup, step-by-step run instructions.                                                                  | in progress |  50 | "Run the complete app with Docker", "Local development" exist; prerequisites are incomplete |
| A "Resources" section: references, and which AI tools were used for which tasks.                                                                        | not started |   0 | none                                                                                        |
| "Team Information": each member, their roles, and their responsibilities.                                                                               | not started |   0 | none                                                                                        |
| "Project Management": how the team organized the work, the tools, and the communication channels.                                                       | not started |   0 | none                                                                                        |
| "Technical Stack": frontend, backend, database and why, other libraries, justification of major choices.                                                | in progress |  40 | a "Stack" section exists, no justification                                                  |
| "Database Schema": a description or a diagram of the tables and relations.                                                                              | not started |   0 | `docs/db-schemas.md` exists, the README does not link it                                    |
| "Features List": all implemented features, who worked on each, what each does.                                                                          | not started |   0 | none                                                                                        |
| "Modules": all chosen modules, the point calculation, the justification (required for Modules of choice), how each was implemented, who worked on each. | not started |   0 | none                                                                                        |
| "Individual Contributions": what each member contributed, and the challenges.                                                                           | not started |   0 | none                                                                                        |
| The README must be in English.                                                                                                                          | done        | 100 |                                                                                             |

## 4. Claimed modules

Points: Major = 2, Minor = 1. Total claimed: 17.

### 4.1 Web: framework for frontend and backend — Major, 2 — done — 100%

- Use a frontend framework (React, Vue, Angular, Svelte, etc.). **done**: React, Expo on mobile.
- Use a backend framework (Express, NestJS, Django, etc.). **done**: NestJS.

### 4.2 Web: ORM for the database — Minor, 1 — done — 100%

- Use an ORM for the database. **done**: Drizzle, `apps/api/src/database/schema.ts`.

### 4.3 Web: Progressive Web App — Minor, 1 — very low priority — 10%

- The web app must be a PWA with offline support and installability. **not started**: no manifest and no service worker in `apps/web`. The offline database exists (remelonDB), the PWA shell does not. Plan item A14. Very low priority since 2026-09-01, gamification first (section 6); not counted in the 17.

### 4.4 Web: custom design system — Minor, 1 — in progress — 50%

- Make a custom design system with reusable components. It must include a color palette, typography, and icons. Minimum: 10 reusable components. **in progress**: the component count is met, 11 in `apps/web/src/components/ui`; palette, typography, and icons are not documented as a system, so one of the two requirements is met. Mobile has four hand-rolled primitives on the same palette names; adopting react-native-reusables is under discussion. Plan item A15.

### 4.5 Web: advanced search — Minor, 1 — open — 10%

- Implement advanced search with filters, sorting, and pagination. **not started**: `CardList.tsx` has a text search inside one deck (substring match on front and back). There are no filters, no sorting, no pagination, and no issue. Plan item A09. Open since 2026-09-01, the reserve Minor (section 6); not counted in the 17.

### 4.6 User Management: OAuth 2.0 — Minor, 1 — done — 100%

- Implement remote authentication with OAuth 2.0 (Google, GitHub, 42, etc.). **done**: Google and Facebook in `apps/api/src/auth/auth.service.ts`, tested in `social-login.e2e-spec.ts`.

### 4.7 Artificial Intelligence: complete LLM system interface — Major, 2 — in progress — 65%

- Generate text or images from user input. **done**: card generation jobs, `apps/api/src/ai`; gemma4 is the default and the benchmarked models are selectable through one shared `AI_MODELS` list (#197, merged 2026-08-31). A web playground is in review (#217).
- Handle streaming responses correctly. **not started**: no streaming in `apps/api/src/ai` (#80).
- Implement error handling and rate limiting. **done**: job quotas (`AI_MAX_*`), gateway errors mapped, LiteLLM per-key limits.

### 4.8 Data and Analytics: data export and import — Minor, 1 — in review — 90%

- Export data in multiple formats (JSON, CSV, XML, etc.). **done**: JSON and CSV, `packages/offline-db/src/export.ts` (#249, closes #192).
- Import data with validation. **done**: Zod schema validation and data-integrity checks, `packages/offline-db/src/import.ts` (#249).
- Support bulk operations. **done**: the whole import runs inside one `db.batch()` transaction, all-or-nothing (#249).

PR #249 is a draft opened 2026-09-04: lint, tests, and build pass; not yet merged.

### 4.9 Gaming and user experience: gamification — Minor, 1 — not started — 0%

Scope decided 2026-09-03: badges, leaderboards ranked across the whole user
base, and daily challenges — 3 of the 6 listed options.

- Implement at least 3 of: achievements, badges, leaderboards, XP or levels, daily challenges, rewards. **decided**: badges, leaderboards, daily challenges. Not started.
- The system must be persistent and stored in the database. **not started**
- Give visual feedback to users (notifications, progress bars, etc.). **not started**
- Give clear rules and progression mechanics. **not started**. Plan item A13.

### 4.11 Modules of choice: mobile app — Major, 2 — in progress — 25%

- The module must be substantial and show technical complexity. **in progress, about 50% parity with web**: measured against #143's checklist, 8.75 of 17 items. Done: per-account offline database and sync (#151, #177), and sync now runs on Hermes after remelonDB 0.2.6 (#216, verified on a device against staging 2026-08-31 including a deck push); shared deck, card and review queries live in `@repo/offline-db` (#204, #211). In review: onboarding and route guards (#210). Built, PR pending: deck list with create, edit and delete (#68, first slice). Not started: deck detail and card CRUD, the flashcard viewer, settings, social sign-in, password recovery and change.
- The README must justify: why this module, which technical challenges it addresses, how it adds value, and why it deserves Major status. **not started**: not in the README. This bullet is half the module's score, hence 25%.
- Trivial features or shortcuts cause rejection of the module. Note for the README.

### 4.12 DevOps: monitoring with Prometheus and Grafana — Major, 2 — in review — 40%

- Set up Prometheus to collect metrics. **in review**: #162.
- Configure exporters and integrations. **in review**: API metrics, postgres and node exporters (#162, #167). LiteLLM, DCGM and node metrics from the GX10 go through `ai.dustyway.org`, allow-listed to the production IP, until #193 puts the production VPS on the tailnet; the proxy config is in #222. #162 has changes requested; nothing is merged yet.
- Make custom Grafana dashboards. **in review**: #162.
- Set up alerting rules. **in review**: #188.
- Secure access to Grafana. **in review**: #162.

### 4.13 User Management: user activity analytics and insights dashboard — Minor, 1 — in progress — 50%

Reclassified 2026-09-03. This was tracked as the Data and Analytics
"advanced analytics dashboard" (Major, 2: interactive charts,
real-time updates, export, custom date ranges), none of which the built
dashboard has or was going to grow. It matches User Management's "user
activity analytics and insights dashboard" (Minor, 1) instead, which has no
subject sub-bullets. The plan still calls it the statistics dashboard, A11:
learned words, due cards, streak, points by day, added words by day, reset
progress. The implementation work is unchanged; only the module and the
point count change.

- User activity analytics and insights dashboard. **in progress**:
  `apps/web/src/components/dashboard/Overview.tsx` shows the due-card count
  and the personal dictionary size, both computed live from the store. The
  learning streak (`7 Days`), words learned (`1,240 / 10,000`, `12.4%`) and
  the ready-made dictionary progress are still string literals from the
  concept mockup. The streak and the words-learned figure are computable
  today from `getReviewHistoryQuery`; replacing the literals is the
  remaining work. No issue exists yet.

### 4.14 Accessibility and Internationalization: multiple languages — Minor, 1 — not started — 0%

Decided 2026-09-03.

- Implement i18n (internationalization) system. **not started**
- At least 3 complete language translations. **not started**
- Language switcher in the UI. **not started**
- All user-facing text must be translatable. **not started**

### 4.15 User Management: 2FA — Minor, 1 — not started — 0%

Decided 2026-09-03.

- Implement a complete 2FA (Two-Factor Authentication) system for the users. **not started**

### 4.16 Artificial Intelligence: content moderation AI — Minor, 1 — not started — 0%

Decided 2026-09-03.

- Content moderation AI (auto moderation, auto deletion, auto warning, etc.). **not started**

## 5. Modules not claimed

The plan lists these with reasons. Do not reopen them without a decision:

- Web: user interaction with other users (requires chat).
- User Management: standard user management (requires avatar upload and online status).
- Web: file upload and management (declined; the yoga deck and word-note audio would need it, see #131).
- Game modules (the product is not a game).
- Blockchain (no tournament scores).

## 6. Module set: current status (2026-09-03)

The subject requires 14 points. Incomplete modules count 0. On 2026-08-30 the
plan claimed 17 and the questions below were open. On 2026-08-31, after
Daniel's input on #190, the team gave priority to export/import and the
statistics dashboard because the implementation is shared, put gamification
ahead of PWA, and moved the public API and PWA to very low priority and
advanced search to open: Public API (−2), PWA (−1), and advanced search
(−1) dropped out, the statistics dashboard was added as a Major (+2),
leaving **15 points claimed**. Public API and PWA have stayed out of the
count ever since. In an in-person meeting on 2026-09-03 the team closed the
remaining open questions on top of that 15: recount the statistics dashboard
as the User Management "user activity analytics and insights dashboard"
(Minor, 1) instead of the Data and Analytics "advanced analytics dashboard"
(Major, 2), since the built dashboard never had interactive charts,
real-time updates, export, or date filters and was not going to grow them
(see 4.13) — a net −1; scope gamification to badges, leaderboards ranked
across the whole user base, and daily challenges (no point change, it was
already claimed); and add three more Minor modules: multiple languages
(i18n), 2FA, and content moderation AI (+3). GDPR also stays a reserve, kept
only in case time allows, alongside Public API and PWA. That is 15 − 1 + 3 =
**17 points claimed, 14 required, so up to 3 points may fail.** The original
questions are kept below with the current status on each.

- **PWA (Minor, 1, reserve).** The offline database exists. The missing
  parts are the manifest, the service worker, and installability, about
  1 day. Question: is it justifiable next to the mobile app? An evaluator can
  see offline support and installability claimed twice. The case for both: a
  PWA and a native app solve offline storage, installation, and sync in
  different ways on the same data layer, and the README can present the
  comparison as a learning outcome. Very low priority, kept only in case
  there is time left after the claimed modules; grouped with Public API.
  Not claimed, not counted in the 17.

- **Advanced search (Minor, 1, open).** Filters, sorting, and
  pagination over local queries, 1 to 2 days. Open, not claimed; a reserve
  Minor if one of the claimed points fails.

- **GDPR (Minor, 1, reserve).** Request data, delete with confirmation, export
  in a readable format, confirmation emails. Reuses the export and the
  existing email path. Estimate: 1 to 2 days after export exists. Not
  claimed, kept only in case there is time left.
- **Health check and status page (Minor, 1, open).** A status page and a
  written backup and recovery procedure, on top of the monitoring stack.
  Estimate: about 1 day.

Arithmetic (2026-09-03): claimed 17. Merged 4 pts (framework, ORM, OAuth — 3
modules). In review 3 pts (export/import 1, monitoring 2 — 2 modules). In
progress 6 pts (LLM 2, design system 1, mobile 2, activity analytics
dashboard 1 — 4 modules). Not started 4 pts (gamification, multiple
languages, 2FA, content moderation AI — 4 modules). To reach 14, at most 3 of
the remaining 13 points may be missing at evaluation; advanced search (1) is
an additional reserve outside the 17.

Before any of this: the Privacy Policy and Terms of Service pages, and the
README. They give 0 points and their absence rejects the project.

## 7. Evaluation dry run

The mechanical checks are becoming CI jobs (#251 fresh-clone start and
credential scan, #252 browser flows and console, #253 hostile input).
Until they land they are manual; after, the dry run is green CI plus one
live rehearsal — CI proves the code, it cannot rehearse a demonstration.

- **Rehearse the opening**: clone into an empty directory, `.env.example`
  only, `docker compose up` — the evaluation starts with exactly this,
  so the person driving has done it recently. Read every script the demo
  touches before running it in front of an evaluator.
- **Rehearse the demo in real Chrome**: latest stable, DevTools open,
  console clean, main flows at desktop and phone width, two accounts
  side by side with isolated data and working sync. CI's chromium is not
  the subject's "latest stable Google Chrome", so one real pass stays.
- **People**: all five attend. Each of us can explain and demo what we
  built and point at the commits. Architecture, stack choices and the
  work split are explainable by at least two of us. Everyone knows the
  claimed modules (section 4) and why they qualify.
- **Modules**: a module counts only if every required part works in the
  demo — rehearse each, know where it lives and who built it. Recompute
  section 6's score before the date; 14 points is the floor, and
  anything above it matters only once section 1 passes.
