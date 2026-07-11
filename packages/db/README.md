# @repo/db

Shared Drizzle schema and Postgres migrations. Currently contains the
Better Auth tables (user, session, account, verification).

## Usage

```ts
import { user, session } from '@repo/db/schema';
```

## Changing the schema

The auth tables are generated from auth-config.ts, don't edit them directly.
To change them (e.g. after adding a better-auth plugin):

```sh
cd packages/db
npx @better-auth/cli generate --config auth-config.ts --output src/schema/auth.ts
```

Other tables (decks, cards, ...) can just be added as new files in src/schema/.

After any schema change, regenerate the migration and commit it together
with the schema:

```sh
pnpm --filter @repo/db db:generate
```

Don't edit the SQL files in drizzle/ by hand.
