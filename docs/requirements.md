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

Progress (2026-10-05): **13 modules, 17 points claimed** (Public API and PWA
at very low priority and not counted in the 17, advanced search open and not
counted; see section 6). All 13 claimed modules are merged on `main`. One
module bullet is still in review: the mobile app's justification in the
README, which is part of #456. The Privacy Policy and Terms of Service pages
are merged. One mandatory gap remains on `main` until #456 merges: the
required first line of the README, along with the README sections.

How the percentages are made: a module's figure is the share of its subject
bullets that are met; a partly met bullet gets partial credit, stated in its
line. A table row is 100 or 0, or a hand estimate where work is partial. They
are estimates, not measurements; the evidence column is what to check.

## 1. General requirements (subject III.2)

The subject says the project is rejected if one of these is not met.

| Requirement                                                                                                                                                                                                                                                                                                       | Status |   % | Evidence                                                                                                                             |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | --: | ------------------------------------------------------------------------------------------------------------------------------------ |
| The project must be a web application. It must have a frontend, a backend, and a database.                                                                                                                                                                                                                        | done   | 100 | `apps/web`, `apps/api`, PostgreSQL in `docker-compose.yml`                                                                           |
| The team must use Git. Commit messages must be clear. The repository must show commits from all team members and a proper distribution of work.                                                                                                                                                                   | done   | 100 | 10 authors on `main` (`git shortlog -sn`)                                                                                            |
| Deployment must use containers (Docker or equivalent). It must start with one command.                                                                                                                                                                                                                            | done   | 100 | `docker compose up`, `README.md`                                                                                                     |
| The website must work with the latest stable Google Chrome.                                                                                                                                                                                                                                                       | done   | 100 | `apps/web/e2e` runs stable Chrome against the Compose/nginx stack on every pull request (#325)                                       |
| No warnings or errors about the JavaScript code may appear in the browser console. (Changed in 21.2: only JavaScript warnings and errors count.)                                                                                                                                                                  | done   | 100 | #325: a strict console gate in every browser context; the Browser tests job fails on a JavaScript warning or error                   |
| The project must include a Privacy Policy page and a Terms of Service page. The pages must be easy to reach, for example from a footer. They must have relevant content. They must not be empty or placeholders.                                                                                                  | done   | 100 | public `/privacy` and `/terms` in `apps/landing`, linked from its footer and covered by `apps/landing/src/App.test.tsx` (#374, #379) |
| The website must support multiple users at the same time. Users must be able to work at the same time without conflicts or performance problems. Concurrent actions must be handled correctly. Real-time updates must reach all connected users when applicable. No data corruption or race conditions may occur. | done   | 100 | #325: three-context isolation/sync and account switching; sync uses triggers, not push                                               |

## 2. Technical requirements (subject III.3)

| Requirement                                                                                                                                               | Status            |   % | Evidence                                                                                                                                                                   |
| --------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | --: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The frontend must be clear, responsive, and accessible on all devices.                                                                                    | done, with a note |  80 | #325: desktop and phone viewports with overflow and clipping checks on every pull request; accessibility labels are translated (#468); no accessibility audit has been run |
| Use a CSS framework or a styling solution.                                                                                                                | done              | 100 | Tailwind CSS                                                                                                                                                               |
| Store credentials in a local `.env` file that Git ignores. Supply an `.env.example` file.                                                                 | done              | 100 | `apps/api/.env.example`, `.gitignore`                                                                                                                                      |
| The database must have a clear schema and well-defined relations.                                                                                         | done              | 100 | `docs/db-schemas.md`                                                                                                                                                       |
| The application must have basic user management. Users must sign up and log in securely. At minimum: email and password with hashed and salted passwords. | done              | 100 | Better Auth, `apps/api/src/auth`                                                                                                                                           |
| All forms and user inputs must be validated in the frontend and in the backend.                                                                           | done              | 100 | Zod schemas in `@repo/schemas`, used by web, mobile, and api                                                                                                               |
| Every connection to the backend from a browser, a script, or an external API must use HTTPS. Connections inside the backend can be without encryption.    | done              | 100 | nginx TLS on the VPS, `docs/deployment.md`                                                                                                                                 |

## 3. README requirements (subject, "Readme Requirements")

The subject says the README is a critical part of the evaluation.

| Requirement                                                                                                                                             | Status    |   % | Evidence                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | --: | --------------------------------------------------------------------------------------------------------- |
| The first line must be in italics and read: _This project has been created as part of the 42 curriculum by <login1>, <login2>, ..._                     | in review |  90 | #456 adds it; on `main` the first line is still `# NotAnotherCards`, which is a **gap** until #456 merges |
| A "Description" section: the project name, its goal, an overview, and the key features.                                                                 | in review |  90 | #456                                                                                                      |
| An "Instructions" section: prerequisites, `.env` setup, step-by-step run instructions.                                                                  | in review |  90 | #456                                                                                                      |
| A "Resources" section: references, and which AI tools were used for which tasks.                                                                        | in review |  90 | #456                                                                                                      |
| "Team Information": each member, their roles, and their responsibilities.                                                                               | in review |  90 | #456                                                                                                      |
| "Project Management": how the team organized the work, the tools, and the communication channels.                                                       | in review |  90 | #456                                                                                                      |
| "Technical Stack": frontend, backend, database and why, other libraries, justification of major choices.                                                | in review |  90 | #456                                                                                                      |
| "Database Schema": a description or a diagram of the tables and relations.                                                                              | in review |  90 | #456                                                                                                      |
| "Features List": all implemented features, who worked on each, what each does.                                                                          | in review |  90 | #456                                                                                                      |
| "Modules": all chosen modules, the point calculation, the justification (required for Modules of choice), how each was implemented, who worked on each. | in review |  90 | #456                                                                                                      |
| "Individual Contributions": what each member contributed, and the challenges.                                                                           | in review |  90 | #456                                                                                                      |
| The README must be in English.                                                                                                                          | done      | 100 |                                                                                                           |

## 4. Claimed modules

Points: Major = 2, Minor = 1. Total claimed: 17.

### 4.1 Web: framework for frontend and backend — Major, 2 — done — 100%

- Use a frontend framework (React, Vue, Angular, Svelte, etc.). **done**: React, Expo on mobile.
- Use a backend framework (Express, NestJS, Django, etc.). **done**: NestJS.

### 4.2 Web: ORM for the database — Minor, 1 — done — 100%

- Use an ORM for the database. **done**: Drizzle, `apps/api/src/database/schema.ts`.

### 4.3 Web: Progressive Web App — Minor, 1 — very low priority — 10%

- The web app must be a PWA with offline support and installability. **not started**: no manifest and no service worker in `apps/web`. The offline database exists (remelonDB), the PWA shell does not. Plan item A14. Very low priority since 2026-09-01, gamification first (section 6); not counted in the 17.

### 4.4 Web: custom design system — Minor, 1 — done — 100%

- Make a custom design system with reusable components. It must include a color palette, typography, and icons. Minimum: 10 reusable components. **done**: 15 components in `apps/web/src/components/ui`; `docs/design.md` documents the palette, typography, icons and the component inventory (#230, #474). Mobile uses the same palette tokens, and `pnpm check:design-docs` fails CI when the two palettes or the inventory drift (#478).

### 4.5 Web: advanced search — Minor, 1 — open — 10%

- Implement advanced search with filters, sorting, and pagination. **not started**: `CardList.tsx` has a text search inside one deck (substring match on front and back). There are no filters, no sorting, no pagination, and no issue. Plan item A09. Open since 2026-09-01, the reserve Minor (section 6); not counted in the 17.

### 4.6 User Management: OAuth 2.0 — Minor, 1 — done — 100%

- Implement remote authentication with OAuth 2.0 (Google, GitHub, 42, etc.). **done**: Google in `apps/api/src/auth/auth.service.ts`, tested in `social-login.e2e-spec.ts`.

### 4.7 Artificial Intelligence: complete LLM system interface — Major, 2 — done — 100%

- Generate text or images from user input. **done**: card generation jobs, `apps/api/src/ai`; gemma4 is the default and the benchmarked models are selectable through one shared `AI_MODELS` list (#197, merged 2026-08-31). The web playground merged as #312.
- Handle streaming responses correctly. **done**: the playground streams generation (`POST /api/ai/playground/stream`, #80); usage recorded per run. `docs/ai-generation.md` describes the whole path.
- Implement error handling and rate limiting. **done**: job quotas (`AI_MAX_*`), gateway errors mapped, LiteLLM per-key limits.

### 4.8 Data and Analytics: data export and import — Minor, 1 — done — 100%

- Export data in multiple formats (JSON, CSV, XML, etc.). **done**: JSON and CSV, `packages/offline-db/src/export.ts` (#296, closes #192).
- Import data with validation. **done**: Zod schema validation and data-integrity checks, `packages/offline-db/src/import.ts` (#296).
- Support bulk operations. **done**: the whole import runs inside one `db.batch()` transaction, all-or-nothing (#296).

### 4.9 Gaming and user experience: gamification — Minor, 1 — done — 100%

Scope decided 2026-09-03: badges, leaderboards ranked across the whole user
base, and daily challenges — 3 of the 6 listed options.

- Implement at least 3 of: achievements, badges, leaderboards, XP or levels, daily challenges, rewards. **done**: badges (#367), a global leaderboard (#402) and daily challenges on the dashboard overview, on shared activity rules (#339).
- The system must be persistent and stored in the database. **done**: badge awards and daily challenges are stored by `apps/api/src/gamification` (#359).
- Give visual feedback to users (notifications, progress bars, etc.). **done**: progress bars for the daily goals on web and in the mobile overview (#419), and a notification on web when a challenge is completed.
- Give clear rules and progression mechanics. **done**: the rules are one shared module used by the API and both clients (#339), and the overview states each goal and its progress.

### 4.11 Modules of choice: mobile app — Major, 2 — in review — 90%

- The module must be substantial and show technical complexity. **done**: #143's checklist is closed. Per-account offline database and sync (#151, #177); onboarding and route guards (#210); deck list and deck detail with card create, edit and delete (#240, #242, #490); review with swipe answers (#387, #400, #435); overview with statistics, sync status, goals and achievements (#419); settings and profile editing (#358); Google sign-in and password reset (#293, #392); 2FA sign-in and management (#384); community decks and publishing (#462); AI fill-in for a word (#463); four interface languages (#475). Deck, card, review and study rules are shared with web through `@repo/offline-db`, `@repo/study` and `@repo/api-client` (#211, #431, #448). Signed release builds are published to an F-Droid repository and as GitHub releases (#401; 0.0.5 on 2026-10-05).
- The README must justify: why this module, which technical challenges it addresses, how it adds value, and why it deserves Major status. **in review**: the Modules section of #456; the longer version is "Why a mobile app" in `docs/mobile.md`.
- Trivial features or shortcuts cause rejection of the module. Note for the README.

### 4.12 DevOps: monitoring with Prometheus and Grafana — Major, 2 — done — 100%

- Set up Prometheus to collect metrics. **done**: the monitoring stack and its
  production deployment are merged in #162.
- Configure exporters and integrations. **done**: API metrics plus the postgres
  and VPS node exporters are implemented in #162 and #167. LiteLLM, DCGM, and
  node metrics are scraped directly from the GX10's tailnet address. The old
  public metrics paths and their subtrees return 404.
- Make custom Grafana dashboards. **done**: #162 provisions dashboards for AI
  queues, API and VPS health, and GX10 GPU and inference metrics.
- Set up alerting rules. **done**: #162 includes the rules from #188 and routes
  notifications through Alertmanager to Slack.
- Secure access to Grafana. **done**: #162 requires admin credentials and serves
  Grafana through the HTTPS nginx endpoint.

### 4.13 User Management: user activity analytics and insights dashboard — Minor, 1 — done — 100%

Reclassified 2026-09-03. This was tracked as the Data and Analytics
"advanced analytics dashboard" (Major, 2: interactive charts,
real-time updates, export, custom date ranges), none of which the built
dashboard has or was going to grow. It matches User Management's "user
activity analytics and insights dashboard" (Minor, 1) instead, which has no
subject sub-bullets. The plan still calls it the statistics dashboard, A11:
learned words, due cards, streak, points by day, added words by day, reset
progress. The implementation work is unchanged; only the module and the
point count change.

- User activity analytics and insights dashboard. **done** (#361):
  - Due today counts active cards whose `due_at` has passed.
  - Personal dictionary size counts active cards.
  - Current and longest streaks count distinct UTC dates with reviews.
  - Learned notes count notes with a rating 2–4 review on one of their cards.
  - Reviews per day count review events by `reviewed_at` UTC date.
  - Notes added per day count distinct notes by `created_at` UTC date.
  - Forgot rate is the share of a UTC day's reviews rated 1.
  - Due forecast groups active cards by `due_at`: overdue through today,
    tomorrow, and the following seven UTC days.
  - Card maturity groups active cards by `scheduled_interval_minutes`: new
    (0, never reviewed), learning (under a day), young (1 to 20 days),
    mature (21 days and up).
  - The per-day series cover 7 or 30 days; the one-year range sums the same
    figures into 12 UTC months.
  - Reset progress from plan A11 is deliberately not built: it deletes
    review history across synced devices and the module does not need it.

All figures are derived from reactive local remelonDB queries and work
offline. The optional deck filter follows active note-to-deck memberships;
a note shared by several decks contributes to each of them.

### 4.14 Accessibility and Internationalization: multiple languages — Minor, 1 — done — 100%

Decided 2026-09-03.

- Implement i18n (internationalization) system. **done**: `@repo/i18n` with i18next, shared by web and mobile (#417).
- At least 3 complete language translations. **done**: English, German, Spanish and Russian catalogs in `packages/i18n/src/catalogs`.
- Language switcher in the UI. **done**: in the settings of both clients.
- All user-facing text must be translatable. **done**: web (#428, #487, with a lint rule against literal JSX text) and mobile (#475), including validation messages from the shared schemas (#429) and accessibility labels (#468).

### 4.15 User Management: 2FA — Minor, 1 — done — 100%

Decided 2026-09-03.

- Implement a complete 2FA (Two-Factor Authentication) system for the users. **done**: TOTP with backup codes in the API (#324); enrollment, challenge and recovery on web (#364); sign-in and management on mobile (#384). `apps/api/test/two-factor-oauth.e2e-spec.ts` covers the interaction with Google sign-in.

### 4.16 Artificial Intelligence: content moderation AI — Minor, 1 — done, with a note — 100%

Decided 2026-09-03.

- Content moderation AI (auto moderation, auto deletion, auto warning, etc.).
  **done**: every card is checked by a classifier at publish (#332); an
  unsafe card refuses publication and names the card and its category, and a
  controversial one publishes with a warning (auto moderation, auto warning).
  A signed-in report queues a re-check by two classifiers; either one can
  automatically take down the exact public snapshot, and an operator can take
  down content the models miss (#342). Every classifier verdict is stored and
  shown to the owner, with an on-demand streamed explanation, and a report
  alone never hides a deck. `docs/ai-generation.md` describes the whole path,
  including the operator calls.

Notes: on production, 2026-10-05, three decks of about 500 cards each were
published; five harmless vocabulary cards came back as warnings and one was
refused on staging earlier (#450 lists them and the benchmark behind the
planned fix). A deck of about 1,500 cards does not fit the publish deadline
(#449). Round two of the classifier benchmark has not been run, so
ShieldGemma remains the independent classifier for re-checks. The report and
operator endpoints are covered by `apps/api/test/sync/sharing.test.ts`; the
report-to-takedown path has not been exercised by hand on production.

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

Arithmetic (2026-10-05): claimed 17, and all 13 modules are merged: 17
points. One module bullet is still in review, the mobile app's README
justification (#456); if it were missing at the evaluation, the mobile
module's 2 points would be at risk and 15 would remain. Advanced search (1)
is a reserve outside the 17 and has not been built.

Before any of this: the required first line of the README (#456). It gives 0
points and its absence rejects the project.

## 7. Evaluation dry run

Browser coverage for #252 is implemented in `apps/web/e2e`: registration,
onboarding, deck/card edits, review ratings, three-context sync/isolation,
account switching, and representative validation/XSS checks. `pnpm e2e` uses
stable Chrome against the Compose/nginx stack at desktop and phone widths,
with a strict browser-console gate and overflow/critical-control clipping checks.
These are evidence for the covered paths, not complete accessibility, responsive
layout, or security certification.
See the README for setup and failure artifacts.

Of the mechanical checks, the browser flows and console gate run in CI as
the Browser tests job (#252, merged as #325). The fresh-clone start with the
credential scan (#251) and the hostile-input corpus (#253) are open, so
those two stay manual. The dry run is green CI plus one live rehearsal — CI
proves the code, it cannot rehearse a demonstration.

- **Rehearse the opening**: clone into an empty directory, `.env.example`
  only, `docker compose up` — the evaluation starts with exactly this,
  so the person driving has done it recently. Read every script the demo
  touches before running it in front of an evaluator.
- **Rehearse the demo in real Chrome**: latest stable, DevTools open,
  console clean, main flows at desktop and phone width, two accounts
  side by side with isolated data and working sync. The browser suite uses
  stable Chrome, but the live rehearsal still covers the full demonstration.
- **People**: all five attend. Each of us can explain and demo what we
  built and point at the commits. Architecture, stack choices and the
  work split are explainable by at least two of us. Everyone knows the
  claimed modules (section 4) and why they qualify.
- **Modules**: a module counts only if every required part works in the
  demo — rehearse each, know where it lives and who built it. Recompute
  section 6's score before the date; 14 points is the floor, and
  anything above it matters only once section 1 passes.
