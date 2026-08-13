import { createDatabaseManager, Database } from '@remelondb/core'
import { RnSqliteDriver } from '@remelondb/driver-rn'
import { schema, UserDeck, UserCard, ReviewEvent } from '@repo/offline-db'

// Same bootstrap as the web client (apps/web/src/offline/db.ts). Native has
// no tabs, so the takeover callback is unused and the taken-over state is
// unreachable; the manager still gives us the deduplicated open, retryable
// failure, and the shared React hook.
export const manager = createDatabaseManager({
  open: () =>
    Database.open({
      driver: new RnSqliteDriver(),
      schema,
      modelClasses: [UserDeck, UserCard, ReviewEvent],
      name: 'notanothercards.db',
    }),
})
