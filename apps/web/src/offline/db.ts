import { createDatabaseManager, Database } from "@remelondb/core";
import type { DatabaseManagerState } from "@remelondb/core";
import { WebSqliteDriver } from "@remelondb/driver-web";
import {
  schema,
  migrations,
  UserDeck,
  UserCard,
  ReviewEvent,
  UserProfile,
} from "@repo/offline-db";

export type { DatabaseManagerState as DatabaseState };

export let manager: ReturnType<typeof createDatabaseManager> | null = null;

/**
 * OPFS database name for a user. The id is hex-encoded from its UTF-8
 * bytes so that distinct ids always map to distinct names — encoding the
 * full bytes (not `charCodeAt`, which only sees a surrogate's high half)
 * is what keeps two accounts from colliding onto one database file.
 */
export function userDbName(userId: string): string {
  const hex = Array.from(new TextEncoder().encode(userId))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `user_${hex}.db`;
}

export function createUserDatabaseManager(userId: string) {
  const dbName = userDbName(userId);

  manager = createDatabaseManager({
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
  return manager;
}

export async function closeUserDatabase() {
  // manager.close() (remelondb >=0.1.7) tears down the driver and
  // discards an init that resolves after the close.
  await manager?.close();
  manager = null;
}

export async function checkOnboardingComplete(
  userId: string,
): Promise<boolean> {
  let activeManager = manager;
  let shouldClose = false;

  if (!activeManager) {
    activeManager = createUserDatabaseManager(userId);
    shouldClose = true;
  }

  const db = await activeManager.init();
  let complete = false;
  if (db) {
    const profiles = await db.get(UserProfile).query().fetch();
    const profile = profiles[0];
    if (
      profile &&
      profile.username &&
      profile.native_language_id &&
      profile.target_language_id
    ) {
      complete = true;
    }
  }

  if (shouldClose) {
    await closeUserDatabase();
  }
  return complete;
}
