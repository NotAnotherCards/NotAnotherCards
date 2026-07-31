import { createDatabaseManager, Database } from "@remelondb/core";
import { WebSqliteDriver } from "@remelondb/driver-web";
import { schema, UserDeck, UserCard, ReviewEvent } from "@repo/offline-db";
import { useSyncExternalStore } from "react";

export type DatabaseStatus =
  "idle" | "loading" | "ready" | "error" | "taken-over";

export interface DatabaseState {
  status: DatabaseStatus;
  error: Error | null;
}

// Configurable options for the database manager
export const dbOptions = {
  storage: "opfs" as "opfs" | "memory",
  takeover: true,
  shared: true,
};

function buildManager() {
  const m = createDatabaseManager({
    open: async (onTakenOver) => {
      // 1. Check browser support for OPFS if we are using it
      if (dbOptions.storage === "opfs") {
        if (
          typeof navigator === "undefined" ||
          !navigator.storage ||
          !navigator.storage.getDirectory
        ) {
          throw new Error(
            "Origin Private File System (OPFS) is not supported in this browser. " +
              "Please use a modern browser that supports OPFS for persistent local storage.",
          );
        }
      }

      // 2. Instantiate WebSqliteDriver
      const driver = new WebSqliteDriver({
        storage: dbOptions.storage,
        takeover: dbOptions.takeover,
        shared: dbOptions.shared,
        onTakenOver,
      });

      // 3. Open the database
      return Database.open({
        driver,
        schema,
        modelClasses: [UserDeck, UserCard, ReviewEvent],
        name: "notanothercards.db",
      });
    },
  });

  const originalInit = m.init.bind(m);

  return Object.assign(m, {
    getState(): DatabaseState {
      return m.state as DatabaseState;
    },
    getDatabase(): Database {
      return m.database;
    },
    async close(): Promise<void> {
      try {
        await m.database.driver.close();
      } catch {
        // Ignore if database is not open
      }
      // Re-create the manager to reset status to idle
      dbManager = buildManager();
    },
    async init(
      options: { takeover?: boolean; storage?: "opfs" | "memory" } = {},
    ): Promise<Database> {
      if (options.storage) dbOptions.storage = options.storage;
      if (options.takeover !== undefined) dbOptions.takeover = options.takeover;
      return originalInit();
    },
  });
}

export let dbManager = buildManager();
export const manager = dbManager;

/**
 * React hook — matches the @remelondb/core/react API shape.
 * Swap the import for "@remelondb/core/react" once that subpath
 * ships in a published build of core.
 */
export function useDatabaseState(m: typeof manager = manager): DatabaseState {
  return useSyncExternalStore(
    (onStoreChange) => m.subscribe(onStoreChange),
    () => m.state as DatabaseState,
    () => m.state as DatabaseState,
  );
}
