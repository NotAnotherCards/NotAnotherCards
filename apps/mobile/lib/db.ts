import { createDatabaseManager, Database } from '@remelondb/core'
import { RnSqliteDriver } from '@remelondb/driver-rn'
import {
  schema,
  migrations,
  UserDeck,
  UserCard,
  ReviewEvent,
  UserProfile,
  userDbName,
} from '@repo/offline-db'

// Native has no takeover path, but the manager deduplicates concurrent opens,
// exposes retryable state to React, and invalidates an open that finishes late.
export function createUserDatabaseManager(userId: string) {
  return createDatabaseManager({
    open: () =>
      Database.open({
        driver: new RnSqliteDriver(),
        schema,
        migrations,
        modelClasses: [UserDeck, UserCard, ReviewEvent, UserProfile],
        name: userDbName(userId),
      }),
  })
}
