import { createDatabaseManager, Database } from "@remelondb/core";
import { WebSqliteDriver } from "@remelondb/driver-web";
import { schema, UserDeck, UserCard, ReviewEvent } from "@repo/offline-db";
import { useSyncExternalStore } from "react";

export type DatabaseStatus = "idle" | "loading" | "ready" | "error" | "taken-over";

export interface DatabaseState {
  status: DatabaseStatus;
  error: Error | null;
}

class WrappedDatabaseManager {
  private coreManager!: ReturnType<typeof createDatabaseManager>;
  private currentOptions: { takeover?: boolean; storage?: "opfs" | "memory" } = {};
  private listeners = new Set<(state: DatabaseState) => void>();
  private unsubscribeCore: (() => void) | null = null;
  private cachedState: DatabaseState = { status: "idle", error: null };

  constructor() {
    this.createCoreManager();
  }

  private createCoreManager() {
    if (this.unsubscribeCore) {
      this.unsubscribeCore();
    }
    this.coreManager = createDatabaseManager({
      open: async (onTakenOver) => {
        const takeover = this.currentOptions.takeover ?? true;
        const storage = this.currentOptions.storage ?? "opfs";

        // Check browser support for OPFS if we are using it
        if (storage === "opfs") {
          if (
            typeof navigator === "undefined" ||
            !navigator.storage ||
            !navigator.storage.getDirectory
          ) {
            throw new Error(
              "Origin Private File System (OPFS) is not supported in this browser. " +
              "Please use a modern browser that supports OPFS for persistent local storage."
            );
          }
        }

        const driver = new WebSqliteDriver({
          storage,
          shared: true,
          takeover,
          onTakenOver: () => {
            // Identity checks and epoch tagging are handled internally by core's DatabaseManager
            onTakenOver();
          },
        });

        return Database.open({
          driver,
          schema,
          modelClasses: [UserDeck, UserCard, ReviewEvent],
          name: "notanothercards.db",
        });
      },
    });

    this.unsubscribeCore = this.coreManager.subscribe((state) => {
      this.cachedState = {
        status: state.status as DatabaseStatus,
        error: state.error,
      };
      this.listeners.forEach((listener) => listener(this.cachedState));
    });
  }

  get state(): DatabaseState {
    return this.cachedState;
  }

  getState(): DatabaseState {
    return this.state;
  }

  get database(): Database {
    return this.coreManager.database;
  }

  getDatabase(): Database {
    return this.database;
  }

  async init(options: { takeover?: boolean; storage?: "opfs" | "memory" } = {}): Promise<Database> {
    this.currentOptions = options;
    return this.coreManager.init();
  }

  subscribe(listener: (state: DatabaseState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async close(): Promise<void> {
    let db: Database | null = null;
    try {
      db = this.coreManager.database;
    } catch {
      // Ignored if not open or ready
    }

    if (db) {
      await db.driver.close();
    }
    // Re-create the core manager to reset the status to 'idle'
    this.createCoreManager();
  }
}

export const manager = new WrappedDatabaseManager();
export const dbManager = manager;

export function useDatabaseState(m: WrappedDatabaseManager = manager): DatabaseState {
  return useSyncExternalStore(
    (onStoreChange) => m.subscribe(onStoreChange),
    () => m.state,
    () => m.state
  );
}
