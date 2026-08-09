import { createDatabaseManager, Database } from "@remelondb/core";
import type { DatabaseManagerState } from "@remelondb/core";
import { WebSqliteDriver } from "@remelondb/driver-web";
import { schema, UserDeck, UserCard, ReviewEvent } from "@repo/offline-db";

export type { DatabaseManagerState as DatabaseState };

interface TrackedManager {
  manager: ReturnType<typeof createDatabaseManager>;
  close: () => Promise<void>;
}

export let manager: ReturnType<typeof createDatabaseManager> | null = null;
let activeTrackedManager: TrackedManager | null = null;

export function createUserDatabaseManager(userId: string) {
  const hex = Array.from(userId)
    .map((c) => c.charCodeAt(0).toString(16).padStart(2, "0"))
    .join("");
  const dbName = `user_${hex}.db`;

  let isClosed = false;
  let openedDb: Database | null = null;

  const newManager = createDatabaseManager({
    open: async (onTakenOver) => {
      const db = await Database.open({
        driver: new WebSqliteDriver({
          shared: true,
          takeover: true,
          onTakenOver,
        }),
        schema,
        modelClasses: [UserDeck, UserCard, ReviewEvent],
        name: dbName,
      });
      if (isClosed) {
        await db.driver.close();
        throw new Error("Manager closed during initialization");
      }
      openedDb = db;
      return db;
    },
  });

  const closeFn = async () => {
    isClosed = true;
    if (openedDb) {
      await openedDb.driver.close();
      openedDb = null;
    }
  };

  activeTrackedManager = {
    manager: newManager,
    close: closeFn,
  };

  manager = newManager;
  return newManager;
}

export async function closeUserDatabase() {
  if (activeTrackedManager) {
    await activeTrackedManager.close();
    activeTrackedManager = null;
  }
  manager = null;
}
