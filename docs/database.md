# Database

PostgreSQL, managed with Drizzle. The schema lives in
`apps/api/src/database/schema.ts`, generated migrations in `apps/api/drizzle`.

The schema contains the four tables Better Auth needs as well as core app domain tables for offline-first decks, cards, and review tracking.

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

### `user_decks`

Represents a deck (collection of cards) owned by a user.
<<<<<<< HEAD

- **`id`** (text/UUID, Primary Key): Client-generated unique identifier to prevent offline creation collisions.
- **`user_id`** (text/UUID, Foreign Key): Links to `user.id`. Cascades on deletion.
- **`title`** (text, NOT NULL): The deck's display name.
- **`description`** (text, nullable): Optional description of the deck.
- **`created_at` / `updated_at`** (timestamp with time zone): Tracks creation and the last modified time to resolve client sync conflicts.
- **`deleted_at`** (timestamp with time zone, nullable): Used for **soft-deletes (tombstones)**. Instead of immediately hard-deleting a row, we populate this field so that other offline clients can pull the deletion state and update themselves.

**Indexes:**

- **`idx_user_decks_user_updated`**: Composite index on `(user_id, updated_at)` for listing a user's decks by recency.
=======
* **`id`** (text/UUID, Primary Key): Client-generated unique identifier to prevent offline creation collisions.
* **`user_id`** (text/UUID, Foreign Key): Links to `user.id`. Cascades on deletion.
* **`title`** (text, NOT NULL): The deck's display name.
* **`description`** (text, nullable): Optional description of the deck.
* **`created_at` / `updated_at`** (timestamp with time zone): Tracks creation and the last modified time to resolve client sync conflicts.
* **`deleted_at`** (timestamp with time zone, nullable): Used for **soft-deletes (tombstones)**. Instead of immediately hard-deleting a row, we populate this field so that other offline clients can pull the deletion state and update themselves.

**Indexes:**
* **`idx_user_decks_user_updated`**: Composite index on `(user_id, updated_at)` to optimize incremental sync delta pulls.
>>>>>>> 60d2357 (add schema and migrations for user decks, cards, and review events)

---

### `user_cards`

Represents individual vocabulary cards, comparison cards, or phrases.

**Indexes:**

- **`idx_user_cards_user_updated`**: Composite index on `(user_id, updated_at)` for listing a user's cards by recency.
- **`idx_user_cards_due`**: Composite index on `(user_id, due_at)` to quickly fetch the user's active due review queue.
* **`id`** (text/UUID, Primary Key): Client-generated unique identifier.
* **`user_id`** (text/UUID, Foreign Key): Links to `user.id`.
* **`deck_id`** (text/UUID, Foreign Key): Links to `user_decks.id` with `cascade` delete.
* **`front` / `back`** (text, NOT NULL): The card prompt/question and response/translation.
* **`due_at`** (timestamp with time zone, default now): The next scheduled review date-time determined by the spaced repetition algorithm.
* **`created_at` / `updated_at` / `deleted_at`** (timestamp with time zone): Same sync and soft-delete semantics as `user_decks`.

---

### `review_events`

An **append-only** transaction log of all study card reviews.
* **`id`** (text/UUID, Primary Key): Unique review identifier.
* **`user_id`** (text/UUID, Foreign Key): Links to `user.id`.
* **`user_card_id`** (text/UUID, Foreign Key): Links to `user_cards.id` with `cascade` delete.
* **`rating`** (integer, NOT NULL): How well the user remembered the card.
* **`reviewed_at`** (timestamp with time zone, default now): The timestamp when the review session took place.

**Indexes:**
* **`idx_review_events_user_card`**: Composite index on `(user_id, user_card_id)` to quickly pull up study/review history for a specific card.

## Migrations

Run from `apps/api`:

```sh
pnpm db:generate   # generate a migration from schema changes
pnpm db:migrate    # apply pending migrations
pnpm db:push       # push schema directly, dev only
```

## Environment variables

See `apps/api/.env.example`:

- `DATABASE_URL` - Postgres connection string, must match docker-compose.yml
- `BETTER_AUTH_SECRET` - secret for signing/encryption, generate with `openssl rand -base64 32`
- `BETTER_AUTH_URL` - base URL of the API (`http://localhost:3000` in dev)
