import { createDatabaseManager, Database } from "@remelondb/core";
import type { DatabaseManagerState } from "@remelondb/core";
import { WebSqliteDriver } from "@remelondb/driver-web";
import { schema, UserDeck, UserCard, ReviewEvent } from "@repo/offline-db";

export type { DatabaseManagerState as DatabaseState };

export let manager: ReturnType<typeof createDatabaseManager> | null = null;

export function createUserDatabaseManager(userId: string) {
  const hex = Array.from(new TextEncoder().encode(userId))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const dbName = `user_${hex}.db`;

  manager = createDatabaseManager({
    open: (onTakenOver) =>
      Database.open({
        driver: new WebSqliteDriver({
          shared: true,
          onTakenOver,
        }),
        schema,
        modelClasses: [UserDeck, UserCard, ReviewEvent],
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
