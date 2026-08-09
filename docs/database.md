# Database

PostgreSQL, managed with Drizzle. Better Auth owns
`apps/api/src/database/schema.ts`; the syncable app tables live in
`apps/api/src/sync/schema.ts`. Generated migrations are in `apps/api/drizzle`.

Together the schemas contain the four tables Better Auth needs and the core offline-first deck, card, and review tables.

Server scope, revisions, and tombstones remain owned by PostgreSQL and the authenticated sync boundary.

## Auth tables

These follow Better Auth's core schema and are managed through its Drizzle
adapter. Don't rename columns or tables without checking the Better Auth docs
first, the library expects this exact shape.

### `user`

One row per registered user: display `name`, unique `username`, unique
`email`, `email_verified` flag, optional avatar `image`, and the user's IANA
`timezone`. The timezone defaults to `UTC` when a client does not supply one.
The web signup records the browser's local timezone. Better Auth exposes
both additional fields on the session user. Credentials don't live here, see
`account`.

### `session`

Active login sessions. `token` is the value stored in the session cookie,
`expires_at` controls lifetime. `ip_address` and `user_agent` are recorded on
each session. Deleting a user cascades to their sessions.

### `account`

Links a user to an authentication method, one row per provider per user. For
email/password signup the row has `provider_id = 'credential'` and the
password hash in `password`. If we add OAuth providers later (e.g. Google),
their tokens and scopes go into additional rows here, so no `user` table
migration is needed.

### `verification`

Short-lived tokens for flows like email verification and password reset:
`identifier` (usually the email), `value` (the token) and `expires_at`.

## App Domain Tables (Offline-First & Sync-Ready)

These tables support the core spaced repetition features and are designed to sync with the local client-side `remelonDB` sqlite database.

### Why each synced table is declared twice

Every synced table exists in two hand-written forms: a Zod row in
`@repo/offline-db` and a Drizzle table in `apps/api/src/sync/schema.ts`.
They describe different things. The Zod row is the wire contract, the
fields clients exchange and validate. The Drizzle table is that plus the
sync store's machinery: `rev`, `deleted_at`, the `user_id` scope column,
foreign keys, check constraints and indexes, none of which belong on the
wire.

Deriving one from the other (for example with `drizzle-zod`) would make
drift impossible instead of just detected, and stays on the table for
later. It means moving the Drizzle schema into a shared package and
pulling `drizzle-orm` into the web and mobile dependency graphs, which
at three small tables costs more than it saves. For now,
`apps/api/test/sync/schema-parity.test.ts` pins
the two declarations together: every wire field must be a column with
matching nullability, and every column must be a wire field or known
machinery. Drift fails CI with the table and column named.

If the synced model grows well past this size, the derivation approach
is the natural next step (the trade-off is laid out in
[issue #63](https://github.com/NotAnotherCards/NotAnotherCards/issues/63)).

### `user_decks`

Represents a deck (collection of cards) owned by a user.

- **`id`** (text/UUID, Primary Key): Client-generated unique identifier to prevent offline creation collisions.
- **`user_id`** (text, Foreign Key): The authenticated remelonDB scope. It is server machinery and is not accepted from or returned to the client.
- **`title`** (text, NOT NULL): The deck's display name.
- **`description`** (text, nullable): Optional description of the deck.
- **`created_at` / `updated_at`** (double precision): Client-visible Unix time in milliseconds, matching the shared Zod row schema without date mapping.
- **`rev`** (bigint): Server-assigned global revision used for cursors and conflict detection.
- **`deleted_at`** (timestamp with time zone, nullable): Server-only tombstone marker. A delete advances `rev` and updates this value instead of issuing a
  SQL `DELETE`.

**Indexes:**

- **`user_decks_user_rev_idx`**: Composite index on `(user_id, rev)` for incremental pulls.
- **`user_decks_user_updated_idx`**: Composite index on `(user_id, updated_at)` for deck ordering.

---

### `user_cards`

Represents individual vocabulary cards, comparison cards, or phrases.

**Indexes:**

- **`user_cards_user_rev_idx`**: Composite index on `(user_id, rev)` for incremental pulls.
- **`user_cards_user_updated_idx`**: Composite index on `(user_id, updated_at)` for listing a user's cards by recency.
- **`user_cards_user_due_idx`**: Composite index on `(user_id, due_at)` to quickly fetch the user's active due review queue.

- **`id`** (text/UUID, Primary Key): Client-generated unique identifier.
- **`user_id`** (text/UUID, Foreign Key): Links to `user.id`.
- **`deck_id`** (text): Links to `user_decks.id`. This is validated through the authenticated sync engine rather than a cascading SQL foreign key so
  garbage collection can never hard-delete a live child row.
- **`front` / `back`** (text, NOT NULL): The card prompt/question and response/translation.
- **`due_at`** (timestamp with time zone, default now): The next scheduled review date-time determined by the spaced repetition algorithm.
- **`created_at` / `updated_at` / `due_at`** (double precision): Unix time in milliseconds. `rev` and `deleted_at` have the same server-only semantics as
  `user_decks`.

---

### `review_events`

An **append-only** transaction log of all study card reviews.

- **`id`** (text/UUID, Primary Key): Unique review identifier.
- **`user_id`** (text/UUID, Foreign Key): Links to `user.id`.
- **`user_card_id`** (text): Links to `user_cards.id` and is validated by the sync engine.
- **`rating`** (integer, NOT NULL): How well the user remembered the card.
- **`reviewed_at`** (double precision): Client-recorded Unix time in milliseconds.
- **`rev` / `deleted_at`**: The same revision and tombstone machinery used by the other synced tables.

**Indexes:**

- **`review_events_user_rev_idx`**: Composite index on `(user_id, rev)` for incremental pulls.
- **`review_events_user_card_idx`**: Composite index on `(user_id, user_card_id)` for review history.

## remelonDB bookkeeping and retention

`remelon_rev` is the global revision sequence. `remelon_sync_meta` holds the
persisted `gc_floor`, and `remelon_revision_checkpoints` records the highest
served revision at a point in time.

The initial retention policy keeps tombstones for `90 days`. Run the entry point daily from a scheduler, or manually:

```sh
pnpm --filter api sync:gc
```

Each run records a checkpoint and garbage-collects through the newest checkpoint
that is at least 90 days old. The floor never decreases; incremental cursors
older than it receive `resyncRequired`. Deck titles/descriptions and card fronts
and backs are scrubbed in the same update that creates their tombstones, before
the retention window elapses.

Parent deletion uses a transactional tombstone cascade: deleting a deck also
tombstones its active cards and their review events, and deleting a card also
tombstones its review events. If one push deletes a parent while creating or
updating one of its descendants, the parent deletion is rejected and remains
dirty; the descendant write can commit, and retrying the parent deletion then
cascades from the resulting consistent state.

## Migrations

Run from `apps/api`:

```sh
pnpm db:generate   # generate a migration from schema changes
pnpm db:migrate    # apply pending migrations
pnpm db:push       # push schema directly, dev only
```

## Environment variables

See `apps/api/.env.example`:

- `DATABASE_URL` - application Postgres connection string, used by the API,
  migrations, and garbage collection. For local development it must match
  `docker-compose.yml`.
- `TEST_DATABASE_URL` - optional base/admin Postgres connection used by the
  remelonDB store and endpoint integration tests. When it is absent, the test
  fixture falls back to `DATABASE_URL`.
- `BETTER_AUTH_SECRET` - secret for signing/encryption, generate with `openssl rand -base64 32`
- `BETTER_AUTH_URL` - base URL of the API (`http://localhost:3000` in dev)

### Test database isolation

The PostgreSQL sync tests do not apply app migrations to or truncate application
tables in the database named by `TEST_DATABASE_URL` or `DATABASE_URL`. They use
that URL as an administrative connection to the PostgreSQL server, create a
uniquely named temporary database, apply all checked-in migrations there, and
drop it during normal suite cleanup.

Without `TEST_DATABASE_URL` (or `DATABASE_URL`) these suites skip. To run
them locally against a throwaway server:

```sh
docker run -d --name nac-test-pg -p 54329:5432 \
  -e POSTGRES_USER=test -e POSTGRES_PASSWORD=test postgres:18-alpine
TEST_DATABASE_URL=postgresql://test:test@localhost:54329/postgres pnpm --filter api test
```

CI runs them the same way against its postgres service.
