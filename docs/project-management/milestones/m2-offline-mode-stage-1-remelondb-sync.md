# Milestone 2 - Offline mode stage 1 with remelonDB

## M2-01 - Define the offline data model

Type: Backend / Database

### Goal

Define the first syncable domain model for offline mode and implement the
initial PostgreSQL tables with Drizzle.

The backend already has a PostgreSQL connection for auth and general
infrastructure. What is missing is the app-domain schema required for offline
decks, cards, reviews, and remelonDB sync persistence.

### Tasks

- Define the stage-1 per-user data model for offline decks, cards, and review
  events.
- Decide the minimum editable card fields supported offline in v1.
- Add Drizzle tables for:
  - `user_decks`
  - `user_cards`
  - `review_events`
- Add any required indexes for:
  - `user_id`
  - `deck_id`
  - `due_at`
  - `updated_at`
  - `user_card_id`
- Generate and run the migration.
- Document the model in `docs/database.md`.

### Acceptance criteria

- Drizzle schema contains `user_decks`, `user_cards`, and `review_events`.
- The schema supports:
  - offline deck CRUD;
  - offline card CRUD;
  - offline review queue reads;
  - offline card edits;
  - append-only review history.
- `docs/database.md` explains the new tables.

### Useful links

- https://github.com/dustyway/remelonDB/blob/main/docs/tutorial.md
- https://github.com/dustyway/remelonDB/blob/main/docs/tutorial.md#2-define-the-schema

## M2-02 - Create the shared remelonDB schema package

Type: Shared package

Depends on: M2-01

### Goal

Create a shared package that owns the remelonDB schema, models, and wire
validators used by both the web app and the API.

### Tasks

- Create `packages/offline-db`.
- Add dependencies required for remelonDB shared definitions.
- Define Zod row schemas for stage-1 synced tables.
- Include shared definitions for deck/card relationships.
- Define remelonDB tables with `zodTable(...)`.
- Define `appSchema(...)`.
- Define model classes with `ModelFor(...)`.
- Define sync wire validators with `syncSchemas(...)`.
- Export record and row types.

### Acceptance criteria

- `apps/web` can import the shared remelonDB schema package.
- `apps/api` can import the shared remelonDB schema package.
- Synced row validation exists in one place only.
- TypeScript builds successfully across the workspace.

### Useful links

- https://github.com/dustyway/remelonDB/blob/main/docs/tutorial.md
- https://github.com/dustyway/remelonDB/blob/main/docs/tutorial.md#3-define-the-models
- https://github.com/dustyway/remelonDB/blob/main/examples/todo-sync/backend/schema.ts

## M2-03 - Add remelonDB local database bootstrap to the web app

Type: Frontend / Offline

Depends on: M2-02

### Goal

Open a persistent local SQLite database in the web app and expose a small API
for app code to use it.

### Tasks

- Install remelonDB web dependencies (`@remelondb/core` & `@remelondb/driver-web`) in `apps/web`.
- Create `apps/web/src/offline/db.ts`.
- Open the database with `WebSqliteDriver`.
- Register shared schema and model classes.
- Decide multi-tab behavior for stage 1.
- Implement basic user-facing handling for:
  - database unavailable;
  - another tab owning the database;
  - takeover if enabled.

### Acceptance criteria

- The web app opens remelonDB successfully in supported browsers.
- The local database uses persistent OPFS storage.
- Failure to open the DB is surfaced clearly.
- Multi-tab behavior is documented and not silent.

### Useful links

- https://github.com/dustyway/remelonDB/blob/main/docs/tutorial.md#4-open-the-database
- https://github.com/dustyway/remelonDB/blob/main/packages/driver-web/README.md
- https://github.com/dustyway/remelonDB/blob/main/packages/driver-web/README.md#multi-tab-usage
- https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system

## M2-04 - Build deck and card application UI

Type: Frontend / UI

Depends on: M2-01

### Goal

Build the first real deck and card components to test from the UI that the sync engine works correctly.

### Tasks

- Design and build UI for:
  - deck list;
  - deck detail;
  - card detail;
  - create/edit/delete deck flows;
  - create/edit/delete card flows.
- Extract reusable deck/card form and display components.
- Keep the UI compatible with later offline-first wiring.
- Add basic empty, loading, and error states that remain useful after this
  milestone.

### Acceptance criteria

- The app has reusable deck and card UI components intended for long-term use.
- Users can reach deck and card CRUD flows through normal app navigation.
- The screens/components are not framed as temporary sync-only tooling.
- The UI is ready to be connected to online and offline data sources.

### Useful links

I think here might make sense to use Anki as reference

- https://docs.ankiweb.net/templates/intro.html
- https://docs.ankiweb.net/getting-started.html
- https://github.com/dustyway/remelonDB/tree/main/examples/todo-sync/frontend

## M2-05 - Wire deck and card UI to remelonDB locally

> Here might be a good idea that the person tha does M2-04, also takes this ticket

Type: Frontend

Depends on: M2-03, M2-04

### Goal

Connect the permanent deck/card UI to remelonDB so the same product screens work
with local-first reads and writes.

### Tasks

- Add query helpers for:
  - deck list;
  - deck detail;
  - personal dictionary;
  - due cards;
  - card detail;
  - review history as needed.
- Add a thin React bridge for observed queries.
- Make the deck/card screens read from the local DB instead of network-only
  state.
- Implement local writes for:
  - creating a deck;
  - renaming or deleting a deck;
  - creating a card;
  - editing a user card;
  - deleting a user card;
  - recording a review event;
  - updating due state after review.

### Acceptance criteria

- The deck/card product UI renders from local remelonDB state.
- Deck CRUD works locally without the network.
- Card CRUD works locally without the network.
- Edits appear immediately without waiting for the network.
- Review actions update the due queue locally.
- Reloading the app preserves local offline state.

### Useful links

- https://github.com/dustyway/remelonDB/blob/main/docs/tutorial.md#6-the-study-queue
- https://github.com/dustyway/remelonDB/blob/main/docs/tutorial.md#7-live-counts-for-the-ui
- https://github.com/dustyway/remelonDB/blob/main/docs/tutorial.md#8-record-a-review
- https://github.com/dustyway/remelonDB/blob/main/docs/reference/database.md
- https://github.com/dustyway/remelonDB/blob/main/examples/todo-sync/backend/client.ts

## M2-06 - Implement authenticated remelonDB sync endpoints in NestJS

Type: Backend

Depends on: M2-02

### Goal

Expose the canonical remelonDB HTTP sync binding from the NestJS API.

### Tasks

- Create `apps/api/src/sync`.
- Add `SyncModule`, controller, and service.
- Add authenticated `POST /sync/pull`.
- Add authenticated `POST /sync/push`.
- Parse request payloads with shared wire schemas.
- Scope handlers by authenticated `userId`.
- Return protocol variants as JSON response bodies.
- Ensure the sync engine is wired to PostgreSQL-backed storage, not a demo
  memory store.

### Acceptance criteria

- Authenticated users can call `/sync/pull` and `/sync/push`.
- Invalid payloads are rejected.
- Sync routes use the authenticated user scope.
- Protocol variants such as `conflict` and `resyncRequired` are preserved.
- No synced backend state relies on in-memory-only storage.

### Useful links

- https://github.com/dustyway/remelonDB/blob/main/docs/tutorial.md#10-sync
- https://github.com/dustyway/remelonDB/blob/main/docs/reference/sync.md
- https://github.com/dustyway/remelonDB/blob/main/examples/todo-sync/backend/server.ts

## M2-07 - Implement a PostgreSQL-backed remelonDB sync store

Type: Backend / Database

Depends on: M2-01, M2-05

### Goal

Implement the persistent storage seam required by remelonDB's server sync
engine.

### Why this ticket is important

This phase must not ship with a service-worker-only or in-memory sync backend.
The backend already has PostgreSQL access; this ticket makes the sync engine use
that durable storage correctly.

### Tasks

- Study the remelonDB sync design and backend storage seam.
- Design the cursor strategy so it is commit-ordered.
- Persist canonical sync state in PostgreSQL.
- Add changelog and tombstone support needed for incremental pulls.
- Implement atomic push application.
- Implement conflict detection against the client's cursor.
- Implement cursor expiry and `resyncRequired` behavior.
- Add automated tests for the store.

### Acceptance criteria

- Pull reads from one consistent snapshot.
- Cursors are not based on wall-clock timestamps alone.
- Deletes remain syncable until the retention window expires.
- Conflicting pushes are rejected with `conflict`.
- Expired or unknown cursors return `resyncRequired`.
- Store tests cover create, update, delete, conflict, and resync paths.
- Synced deck/card/review state survives backend restarts.

### Useful links

- https://github.com/dustyway/remelonDB/blob/main/docs/sync-design.md
- https://github.com/dustyway/remelonDB/blob/main/docs/reference/sync.md
- https://github.com/dustyway/remelonDB/blob/main/docs/tutorial.md#10-sync

## M2-08 - Wire browser sync orchestration

Type: Frontend / Sync

Depends on: M2-04A, M2-05, M2-06

### Goal

Connect the web local database to the API sync endpoints through
`synchronize(...)`.

### Tasks

- Create `apps/web/src/offline/sync.ts`.
- Implement `pullChanges` and `pushChanges`.
- Validate responses with shared wire parsers.
- Expose sync status for the UI.
- Trigger sync:
  - on startup;
  - on reconnect;
  - after deck create/update/delete;
  - after card create/update/delete;
  - after review writes;
  - on a background interval.

### Acceptance criteria

- Local dirty changes are pushed after reconnect.
- Remote changes are pulled into the local DB.
- Sync status is visible to the app.
- A failed sync leaves local state intact.
- Deck and card CRUD are visibly synchronized across sessions.

### Useful links

- https://github.com/dustyway/remelonDB/blob/main/docs/reference/sync.md
- https://github.com/dustyway/remelonDB/blob/main/examples/todo-sync/bac

## M2-09 - Add GitHub CI for lint, build, and test

Type: CI / Tooling

### Goal

Run the basic quality gates automatically on every push and pull request so we stop relying on remembering to do it for PR reviewing.

### Tasks

- Add a GitHub Actions workflow in `.github/workflows`.
- Run:
  - `pnpm install --frozen-lockfile`
  - `pnpm lint`
  - `pnpm build`
  - `pnpm test`
- Configure caching for pnpm dependencies where useful.
- Ensure the workflow runs on:
  - pushes to active branches;
  - pull requests.
- Document the workflow briefly in the README

### Acceptance criteria

- GitHub Actions runs on every push and pull request.
- Lint, build, and test failures are visible in the PR.

### Useful links

- https://docs.github.com/en/actions/use-cases-and-examples/building-and-testing/building-and-testing-nodejs
- https://pnpm.io/continuous-integration
- https://turborepo.dev/docs/guides/ci-vendors/github-actions
