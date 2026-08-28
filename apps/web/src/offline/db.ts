import { createDatabaseManager, Database } from '@remelondb/core';
import type { DatabaseManagerState } from '@remelondb/core';
import { WebSqliteDriver } from '@remelondb/driver-web';
import {
  schema,
  migrations,
  UserDeck,
  UserCard,
  ReviewEvent,
  UserProfile,
  userDbName,
} from '@repo/offline-db';

export type { DatabaseManagerState as DatabaseState };

/**
 * A manager for one account's database. Nothing here owns the instance:
 * remelonDB's useSessionDatabase creates it, closes it, and sequences
 * one session's close against the next one's open. A module global for
 * "the current manager" is what this file used to hold, and what made
 * ownership ambiguous — every caller could reach the same mutable slot.
 */
export function createUserDatabaseManager(userId: string) {
  return createDatabaseManager({
    open: (onTakenOver) =>
      Database.open({
        driver: new WebSqliteDriver({
          shared: true,
          onTakenOver,
        }),
        schema,
        migrations,
        modelClasses: [UserDeck, UserCard, ReviewEvent, UserProfile],
        name: userDbName(userId),
      }),
  });
}
