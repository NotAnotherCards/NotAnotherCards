# Database

PostgreSQL, managed with Drizzle. Better Auth owns
`apps/api/src/database/schema.ts`; the syncable app tables live in
`apps/api/src/sync/schema.ts`. Generated migrations are in `apps/api/drizzle`.

Together the schemas contain the four tables Better Auth needs and the core
offline-first profile, deck, note, generated-card, note-membership, and review
tables.

Server scope, revisions, and tombstones remain owned by PostgreSQL and the authenticated sync boundary.

## Auth tables

These follow Better Auth's core schema and are managed through its Drizzle
adapter. Don't rename columns or tables without checking the Better Auth docs
first, the library expects this exact shape.

### `user`

One row per registered user: display `name`, unique `email`,
`email_verified` flag, optional avatar `image`, and the user's IANA
`timezone`. The timezone defaults to `UTC` when a client does not supply one.
The web signup records the browser's local timezone. Profile settings are not
required during registration. Credentials don't live here, see
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
at this scale costs more than it saves. For now,
`apps/api/test/sync/schema-parity.test.ts` pins
the two declarations together: every wire field must be a column with
matching nullability, and every column must be a wire field or known
machinery. Drift fails CI with the table and column named.

If the synced model grows well past this size, the derivation approach
is the natural next step (the trade-off is laid out in
[issue #63](https://github.com/NotAnotherCards/NotAnotherCards/issues/63)).

### `user_profiles`

The optional, one-to-one synchronized profile for a user. `user_id` is both
the primary key and authenticated sync scope, with cascading deletion from
`user.id`. It stores a nullable, globally unique `username`, plus nullable `bio`, `avatar_file_id`,
`native_language_id`, and `target_language_id`, plus client-visible creation
and update times. The three referenced-resource IDs are UUID columns; foreign
key constraints will be added when the `files` and `languages` domain tables
are introduced. Existing usernames are migrated into the profile's `username`.

As with other synchronized tables, PostgreSQL additionally stores `rev` and
`deleted_at`. Offline timestamps are Unix milliseconds, so the server uses
safe-integer numeric columns rather than PostgreSQL timestamp values.

### `user_decks`

Represents a named collection owned by a user. Decks collect notes through
`user_note_decks`; cards do not carry deck membership themselves.

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

### `user_notes`

The canonical learning content from which review cards are generated. A note
has a subject-independent `note_type`, a versioned serialized JSON payload, and
optional free-form Markdown.

- **`id`** (text/UUID, Primary Key): Client-generated unique identifier.
- **`user_id`** (text, Foreign Key): The authenticated sync scope.
- **`note_type`** (text, NOT NULL): Selects the semantic note family, such as
  `basic` or `word`.
- **`fields_version`** (integer, NOT NULL): Selects the version of that note
  type's validation schema.
- **`fields_json`** (text, NOT NULL): Serialized complete structured note.
- **`additional_content`** (text, nullable): Genuinely free-form Markdown not
  addressed by individual fields or templates.
- **`created_at` / `updated_at`** (double precision): Non-negative safe-integer
  Unix milliseconds.
- **`rev` / `deleted_at`**: Server-managed revision and tombstone fields.

**Indexes:**

- **`user_notes_user_rev_idx`**: Composite index on `(user_id, rev)` for incremental pulls.
- **`user_notes_user_updated_idx`**: Composite index on `(user_id, updated_at)` for recency ordering.

#### `fields_json` validation contract

`fields_json` remains text at the database and sync boundary, but it is not an
unvalidated escape hatch. The shared local/wire validator uses the pair
`(note_type, fields_version)` to look up a Zod schema in an explicit registry,
parses the serialized JSON, and validates the result. Malformed JSON, unknown
type/version pairs, and payloads rejected by the selected schema are rejected
by both the wire contract and the server-side sync store.

Known values that may be edited, regenerated, searched, filtered, or reused by
a template belong in `fields_json`; `additional_content` is only for prose
without those semantics. Only the complete `basic@1` contract is currently
registered. `word@1` remains unsupported until its full stable field and
template contract is defined; that eventual contract must include
`original_language` and `translation_language`, even when a deck supplies
their initial defaults.

---

### `user_cards`

Represents an individual review question generated from a note. The note owns
the source content; each sibling card owns its own schedule and review history.

**Indexes:**

- **`user_cards_user_rev_idx`**: Composite index on `(user_id, rev)` for incremental pulls.
- **`user_cards_user_updated_idx`**: Composite index on `(user_id, updated_at)` for listing a user's cards by recency.
- **`user_cards_note_idx`**: Index on `(note_id)` for finding all sibling cards generated from a note.
- **`user_cards_user_due_idx`**: Composite index on `(user_id, due_at)` to quickly fetch the user's active due review queue.

- **`id`** (text/UUID, Primary Key): Deterministic UUIDv5 derived by the shared
  `cardId(noteId, templateKey)` helper. Every live pushed row is checked by
  recomputing this ID; a client-supplied random or stale ID is rejected.
- **`user_id`** (text/UUID, Foreign Key): Links to `user.id`.
- **`note_id`** (text, NOT NULL): Links to `user_notes.id`. Ownership is
  validated through the authenticated sync engine rather than a cascading SQL
  foreign key so garbage collection can never hard-delete a live child row.
- **`template_key`** (text, NOT NULL): Stable key for the rendering template
  within the note type. Regeneration reconciles cards by
  `(note_id, template_key)` so the schedule survives.
- **`active`** (boolean, NOT NULL, default `true`): Whether this review mode is
  currently enabled. Disabling a mode is soft state, not protocol deletion.
- **`front` / `back`** (text, NOT NULL): Generic Markdown prompt and answer
  rendered from the source note.
- **`scheduled_interval_minutes`** (integer, NOT NULL; server default `0`,
  required on the local/wire row): The card's current interval in whole
  minutes. `0` means the card has never been reviewed. The shared scheduler
  multiplies this value by rating-specific policy constants and updates it
  together with `due_at`; v1 does not store a scheduler `level` or `status`.
- **`created_at` / `updated_at` / `due_at`** (double precision): Unix time in milliseconds. `rev` and `deleted_at` have the same server-only semantics as
  `user_decks`.

---

### `user_note_decks`

Represents note-level membership in a deck. A note can belong to multiple
decks while retaining one canonical payload and one schedule per sibling card.

- **`id`** (text/UUID, Primary Key): Deterministic UUIDv5 derived by the shared
  `noteDeckId(noteId, deckId)` helper. Every live pushed row is checked by
  recomputing this ID; changing either parent without changing the ID is
  rejected.
- **`user_id`** (text, Foreign Key): The authenticated sync scope.
- **`note_id`** (text, NOT NULL): Links to `user_notes.id` through sync-layer
  ownership validation.
- **`deck_id`** (text, NOT NULL): Links to `user_decks.id` through sync-layer
  ownership validation.
- **`active`** (boolean, NOT NULL, default `true`): Whether the note currently
  appears in the deck. Removing membership uses `active = false`; a note with
  no active memberships remains in the personal dictionary.
- **`created_at` / `updated_at`** (double precision): Non-negative safe-integer
  Unix milliseconds.
- **`rev` / `deleted_at`**: Server-managed revision and tombstone fields.

**Indexes:**

- **`user_note_decks_user_rev_idx`**: Composite index on `(user_id, rev)` for incremental pulls.
- **`user_note_decks_user_updated_idx`**: Composite index on `(user_id, updated_at)` for recency ordering.
- **`user_note_decks_note_idx`**: Index on `(note_id)` for resolving a note's memberships.
- **`user_note_decks_deck_idx`**: Index on `(deck_id)` for resolving a deck's notes.

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
and backs are scrubbed in the same update that creates their tombstones. Note
`fields_json` and `additional_content` are likewise blanked before the retention
window elapses.

The parent-deletion policy follows note ownership rather than deck
membership: deleting a note tombstones its cards, note-deck memberships, and
the cards' review events; deleting a deck tombstones only its note-deck
memberships and never the note or its learning progress. Deleting a card still
tombstones its review events. These cascades run transactionally. A parent
delete submitted in the same push as a valid child create or update is rejected,
so the accepted child write cannot be immediately erased by that push.

## Migrations

Run from `apps/api`:

```sh
pnpm db:generate   # generate a migration from schema changes
pnpm db:migrate    # apply pending migrations
pnpm db:push       # push schema directly, dev only
```

Migration `0010_shocking_roulette` deliberately has no compatibility data rewrite.
It adds required note fields to `user_cards` and removes `deck_id`, so a local
database containing the old development cards must be reset before applying
it. For the Compose development database, remove the development volume and
recreate the services:

```sh
docker compose down --volumes
docker compose up --build
```

The shared offline schema likewise moves to version 3. Its local migration
adds `user_notes` and `user_note_decks`, recreates `user_cards` in the new
shape, and clears the now-orphaned review history. Existing local decks and
profiles are preserved; legacy development cards and reviews are not.

This destroys local development data. Production-like or otherwise valuable
databases must not apply this reset-only migration without an explicit data
migration plan.

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

CI runs the root `pnpm test` command through Turbo against its postgres
service. Turbo only forwards environment variables declared on the `test` task
in `turbo.json`; keep that list in sync when a test starts depending on another
environment variable. Without the declaration, the PostgreSQL suites see no
connection URL and skip even when CI provides one. `turbo.json` contains only
the variable names. The workflow supplies disposable localhost database
credentials and an intentionally non-production auth secret; no production
credentials or GitHub secrets are required for these tests.
