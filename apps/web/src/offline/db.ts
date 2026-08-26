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

export let manager: ReturnType<typeof createDatabaseManager> | null = null;

// Which user's database the global manager holds. Guards need this to
// know whether reusing it would cross accounts; the manager itself
// does not record what it opened.
let managerDbName: string | null = null;
function createManagerFor(dbName: string) {
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
        name: dbName,
      }),
  });
}

export function createUserDatabaseManager(userId: string) {
  managerDbName = userDbName(userId);
  manager = createManagerFor(managerDbName);
  return manager;
}

export async function closeUserDatabase(
  instance?: ReturnType<typeof createDatabaseManager> | null,
) {
  // Closes the given manager, or the active one when called bare.
  // manager.close() (remelondb >=0.1.7) tears down the driver and
  // discards an init that resolves after the close.
  const target = instance ?? manager;
  // Clear the global before awaiting, and only while it still points at
  // the target, so closing one instance never nulls out a successor that
  // became active during the await. Clearing on a failed close too keeps
  // the invariant that the global is only ever a manager nobody has
  // tried to close — checks may then adopt it in any state, because
  // init() deduplicates on the same instance.
  if (manager === target) {
    manager = null;
    managerDbName = null;
  }
  await target?.close();
}
