import { Database } from "@remelondb/core";
import { WebSqliteDriver } from "@remelondb/driver-web";
import { schema, UserDeck, UserCard, ReviewEvent } from "@repo/offline-db";
import { useState, useEffect } from "react";

export type DatabaseStatus = "idle" | "loading" | "ready" | "error" | "taken-over";

export interface DatabaseState {
  status: DatabaseStatus;
  error: Error | null;
}

type Listener = (state: DatabaseState) => void;

class DatabaseManager {
  private db: Database | null = null;
  private initPromise: Promise<Database> | null = null;
  private state: DatabaseState = {
    status: "idle",
    error: null,
  };
  private listeners = new Set<Listener>();

  getState(): DatabaseState {
    return { ...this.state };
  }

  getDatabase(): Database {
    if (!this.db) {
      throw new Error("Database is not initialized. Call init() first.");
    }
    return this.db;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    // Emit the current state immediately on subscription
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private updateState(status: DatabaseStatus, error: Error | null = null) {
    this.state = { status, error };
    this.listeners.forEach((listener) => listener(this.state));
  }

  async init(options: { takeover?: boolean; storage?: "opfs" | "memory" } = {}): Promise<Database> {
    // If already loading or ready, return existing promise/database
    if (this.state.status === "ready" && this.db) {
      return this.db;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      this.updateState("loading");

      const takeover = options.takeover ?? true;
      const storage = options.storage ?? "opfs";

      try {
        // 1. Check browser support for OPFS if we are using it
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

        // 2. Instantiate the WebSqliteDriver
        const driver = new WebSqliteDriver({
          storage,
          takeover,
          onTakenOver: () => {
            console.warn("remelonDB database was taken over by another tab.");
            this.db = null;
            this.updateState(
              "taken-over",
              new Error("Database taken over by another tab. Please close other tabs of this application.")
            );
          },
        });

        const databaseName = "ft_transcendence_offline.db";

        // 3. Open the database with remelonDB
        const openedDb = await Database.open({
          driver,
          schema,
          modelClasses: [UserDeck, UserCard, ReviewEvent],
          name: databaseName,
        });

        this.db = openedDb;
        this.updateState("ready");
        return openedDb;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        if (typeof process === "undefined" || process.env.NODE_ENV !== "test") {
          console.error("Failed to bootstrap local database:", error);
        }

        // Customize error message for lock conflicts if takeover was disabled
        let statusError = error;
        if (
          error.message.includes("lock") ||
          error.message.includes("exclusive") ||
          error.message.includes("another tab") ||
          error.message.includes("unavailable")
        ) {
          statusError = new Error(
            "Database is currently locked by another tab. " +
            "Close other tabs of this application to use offline mode."
          );
        }

        this.updateState("error", statusError);
        throw statusError;
      } finally {
        this.initPromise = null;
      }
    })();

    return this.initPromise;
  }

  async close(): Promise<void> {
    if (this.db) {
      await this.db.driver.close();
      this.db = null;
      this.updateState("idle");
    }
  }
}

export const dbManager = new DatabaseManager();

/**
 * React hook to subscribe to the local database status and error states.
 */
export function useDatabaseState(): DatabaseState {
  const [state, setState] = useState<DatabaseState>(() => dbManager.getState());

  useEffect(() => {
    return dbManager.subscribe((newState) => {
      setState(newState);
    });
  }, []);

  return state;
}
