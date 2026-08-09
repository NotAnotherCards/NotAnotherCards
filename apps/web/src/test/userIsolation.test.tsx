import { describe, expect, it, vi, afterAll, beforeEach } from "vitest";
import { createDatabaseManager, Database } from "@remelondb/core";
import { NodeSqliteDriver } from "@remelondb/driver-node";
import { schema, UserDeck, UserCard, ReviewEvent } from "@repo/offline-db";
import { useStore } from "@/hooks/useStore";
import { DatabaseProvider } from "@remelondb/core/react";
import { renderHook, waitFor, act } from "@testing-library/react";
import * as path from "path";
import * as fs from "fs";

let delayDatabaseOpen = false;
let openPromiseResolve: (() => void) | null = null;

let isClosed = false;
let openedDb: Database | null = null;
let activeManager: ReturnType<typeof createDatabaseManager> | null = null;

function getTestDbPath(userId: string) {
  const hex = Array.from(userId)
    .map((c) => c.charCodeAt(0).toString(16).padStart(2, "0"))
    .join("");
  const dbDir = path.join(__dirname, "test-dbs-isolation");
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  return path.join(dbDir, `user_${hex}.db`);
}

vi.mock("../offline/db", () => {
  return {
    get manager() {
      return activeManager;
    },
    createUserDatabaseManager: (userId: string) => {
      const dbPath = getTestDbPath(userId);
      isClosed = false;
      openedDb = null;

      const newManager = createDatabaseManager({
        open: async () => {
          if (delayDatabaseOpen) {
            await new Promise<void>((resolve) => {
              openPromiseResolve = resolve;
            });
          }
          const db = await Database.open({
            driver: new NodeSqliteDriver(),
            schema,
            modelClasses: [UserDeck, UserCard, ReviewEvent],
            name: dbPath,
          });
          if (isClosed) {
            await db.driver.close();
            throw new Error("Manager closed during initialization");
          }
          openedDb = db;
          return db;
        },
      });

      activeManager = newManager;
      return newManager;
    },
    closeUserDatabase: async () => {
      isClosed = true;
      if (openedDb) {
        await openedDb.driver.close();
        openedDb = null;
      }
      activeManager = null;
    },
  };
});

describe("User Database Isolation integration tests", () => {
  beforeEach(() => {
    delayDatabaseOpen = false;
    openPromiseResolve = null;
    isClosed = false;
    openedDb = null;
    activeManager = null;
  });

  afterAll(() => {
    const dbDir = path.join(__dirname, "test-dbs-isolation");
    if (fs.existsSync(dbDir)) {
      fs.rmSync(dbDir, { recursive: true, force: true });
    }
  });

  it("isolates Account A's deck from Account B, and allows Account A to see it again on re-login", async () => {
    const { createUserDatabaseManager, closeUserDatabase } = await import("../offline/db");

    // 1. Log in as user-a
    const managerA = createUserDatabaseManager("user-a");
    await managerA.init();

    const { result: storeA } = renderHook(() => useStore(), {
      wrapper: ({ children }) => (
        <DatabaseProvider manager={managerA}>{children}</DatabaseProvider>
      ),
    });
    await waitFor(() => expect(storeA.current.status).toBe("ready"));

    // Account A creates a deck
    let deckId = "";
    await act(async () => {
      const deck = await storeA.current.createDeck("Spanish Verbs", "Learn Spanish");
      deckId = deck.id;
    });

    // Verify Spanish Verbs deck exists in Account A
    await waitFor(() => expect(storeA.current.decks.map((d) => d.id)).toContain(deckId));

    // Close Database for User A (simulating logout)
    await closeUserDatabase();

    // 2. Log in as user-b
    const managerB = createUserDatabaseManager("user-b");
    await managerB.init();

    const { result: storeB } = renderHook(() => useStore(), {
      wrapper: ({ children }) => (
        <DatabaseProvider manager={managerB}>{children}</DatabaseProvider>
      ),
    });
    await waitFor(() => expect(storeB.current.status).toBe("ready"));

    // Account B cannot query Account A's deck
    await waitFor(() => expect(storeB.current.decks.map((d) => d.id)).not.toContain(deckId));
    expect(storeB.current.decks).toHaveLength(0);

    // Close Database for User B
    await closeUserDatabase();

    // 3. Log back in as user-a
    const managerA2 = createUserDatabaseManager("user-a");
    await managerA2.init();

    const { result: storeA2 } = renderHook(() => useStore(), {
      wrapper: ({ children }) => (
        <DatabaseProvider manager={managerA2}>{children}</DatabaseProvider>
      ),
    });
    await waitFor(() => expect(storeA2.current.status).toBe("ready"));

    // Account A sees the deck again
    await waitFor(() => expect(storeA2.current.decks.map((d) => d.id)).toContain(deckId));
    expect(storeA2.current.decks[0].title).toBe("Spanish Verbs");

    // Clean up
    await closeUserDatabase();
  });

  it("prevents further queries/writes through the old manager after logout", async () => {
    const { createUserDatabaseManager, closeUserDatabase } = await import("../offline/db");
    const manager = createUserDatabaseManager("user-a");
    await manager.init();

    const { result: store } = renderHook(() => useStore(), {
      wrapper: ({ children }) => (
        <DatabaseProvider manager={manager}>{children}</DatabaseProvider>
      ),
    });
    await waitFor(() => expect(store.current.status).toBe("ready"));

    // Logout closes database
    await closeUserDatabase();

    // Attempts to write through the old manager/database should throw/fail
    await expect(store.current.createDeck("Spanish", "")).rejects.toThrow();
  });

  it("aborts database opening if closed during a delayed initialization", async () => {
    const { createUserDatabaseManager, closeUserDatabase } = await import("../offline/db");

    // Set delay flag
    delayDatabaseOpen = true;

    const manager = createUserDatabaseManager("user-a");

    // Start initialization, which will be stuck opening
    const initPromise = manager.init();

    // Verify manager status is loading
    expect(manager.state.status).toBe("loading");

    // Call logout/close before opening completes
    await closeUserDatabase();

    // Resolve the promise to let Database.open finish
    if (openPromiseResolve) {
      openPromiseResolve();
    }

    // Wait for the initialization promise to finish (it should reject/throw because we closed the manager during init)
    await expect(initPromise).rejects.toThrow();

    // Assert the database connection is closed and manager is null
    const { manager: currentManager } = await import("../offline/db");
    expect(currentManager).toBeNull();

    // Reset delay flag
    delayDatabaseOpen = false;
  });

  it("handles tab session transitions by closing user-a database and opening user-b database", async () => {
    const { createUserDatabaseManager, closeUserDatabase } = await import("../offline/db");

    // 1. First session: user-a
    const managerA = createUserDatabaseManager("user-a");
    await managerA.init();

    const { result: storeA } = renderHook(() => useStore(), {
      wrapper: ({ children }) => (
        <DatabaseProvider manager={managerA}>{children}</DatabaseProvider>
      ),
    });
    await waitFor(() => expect(storeA.current.status).toBe("ready"));

    // Write a deck under user-a
    let deckId = "";
    await act(async () => {
      const deck = await storeA.current.createDeck("Tab Deck A", "user-a tab deck");
      deckId = deck.id;
    });

    // 2. Tab/Session switches user to user-b: close A first
    await closeUserDatabase();

    // 3. Open user-b's database
    const managerB = createUserDatabaseManager("user-b");
    await managerB.init();

    const { result: storeB } = renderHook(() => useStore(), {
      wrapper: ({ children }) => (
        <DatabaseProvider manager={managerB}>{children}</DatabaseProvider>
      ),
    });
    await waitFor(() => expect(storeB.current.status).toBe("ready"));

    // Assert that user-b database does not have user-a's deck
    expect(storeB.current.decks.map((d) => d.id)).not.toContain(deckId);

    // Clean up
    await closeUserDatabase();
  });
});
