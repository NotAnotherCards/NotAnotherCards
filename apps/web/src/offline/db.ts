import { createDatabaseManager, Database } from "@remelondb/core";
import type { DatabaseManagerState } from "@remelondb/core";
import { WebSqliteDriver } from "@remelondb/driver-web";
import { schema, UserDeck, UserCard, ReviewEvent } from "@repo/offline-db";

export type { DatabaseManagerState as DatabaseState };

let activeManager: ReturnType<typeof createDatabaseManager> | null = null;

export function createUserDatabaseManager(userId: string) {
  const hex = Array.from(userId)
    .map((c) => c.charCodeAt(0).toString(16).padStart(2, "0"))
    .join("");
  const dbName = `user_${hex}.db`;

  const manager = createDatabaseManager({
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

  activeManager = manager;
  return manager;
}

export async function closeUserDatabase() {
  if (activeManager) {
    if (activeManager.state.status === "ready") {
      try {
        await activeManager.database.driver.close();
      } catch (e) {
        // ignore if already closed
      }
    }
    activeManager = null;
  }
}
