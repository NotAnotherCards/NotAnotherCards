# Database

PostgreSQL, managed with Drizzle. The schema lives in
`apps/api/src/database/schema.ts`, generated migrations in `apps/api/drizzle`.

Currently the schema only contains the four tables Better Auth needs. App
tables (decks, cards, ...) will be added in later milestones.

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
