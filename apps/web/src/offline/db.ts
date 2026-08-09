import { createDatabaseManager, Database } from "@remelondb/core";
import type { DatabaseManagerState } from "@remelondb/core";
import { WebSqliteDriver } from "@remelondb/driver-web";
import { schema, UserDeck, UserCard, ReviewEvent } from "@repo/offline-db";

export type { DatabaseManagerState as DatabaseState };

export let manager: ReturnType<typeof createDatabaseManager> | null = null;

export function createUserDatabaseManager(userId: string) {
  const hex = Array.from(userId)
    .map((c) => c.charCodeAt(0).toString(16).padStart(2, "0"))
    .join("");
  const dbName = `user_${hex}.db`;

  const newManager = createDatabaseManager({
    open: (onTakenOver) =>
      Database.open({
        driver: new WebSqliteDriver({
          shared: true,
          takeover: true,
          onTakenOver,
        }),
        schema,
        modelClasses: [UserDeck, UserCard, ReviewEvent],
        name: dbName,
      }),
  });

  manager = newManager;
  return newManager;
}

export async function closeUserDatabase() {
  if (manager) {
    if (manager.state.status === "ready") {
      await manager.database.driver.close();
    }
    manager = null;
  }
}
