import { describe, expect, it, vi, afterAll, beforeEach } from "vitest";
vi.unmock("@/offline/db");
import type { Database } from "@remelondb/core";
import { NodeSqliteDriver } from "@remelondb/driver-node";
import { useStore } from "@/hooks/useStore";
import { DatabaseProvider } from "@remelondb/core/react";
import { renderHook, waitFor, act } from "@testing-library/react";
import * as path from "path";
import * as fs from "fs";
import { createUserDatabaseManager, closeUserDatabase } from "../offline/db";

// Use var to hoist variables for Vitest mock factories
// eslint-disable-next-line no-var
var delayDatabaseOpen = false;
// eslint-disable-next-line no-var
var openPromiseResolve: (() => void) | null = null;
// eslint-disable-next-line no-var
var isClosed = false;

function getTestDbPath(dbName: string) {
  const dbDir = path.join(__dirname, "test-dbs-isolation");
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  return path.join(dbDir, dbName);
}

// Mock the lower-level Database.open method in @remelondb/core
vi.mock("@remelondb/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@remelondb/core")>();
  return {
    ...actual,
    Database: {
      ...actual.Database,
      open: async (options: Parameters<typeof Database.open>[0]) => {
        if (delayDatabaseOpen) {
          await new Promise<void>((resolve) => {
            openPromiseResolve = resolve;
          });
        }
        // Substitute WebSqliteDriver with NodeSqliteDriver for tests
        const db = await actual.Database.open({
          ...options,
          driver: new NodeSqliteDriver(),
          name: getTestDbPath(options.name),
        });
        if (isClosed) {
          await db.driver.close();
          throw new Error("Manager closed during initialization");
        }
        return db;
      },
    },
  };
});

function testCreateUserDatabaseManager(userId: string) {
  isClosed = false;
  return createUserDatabaseManager(userId);
}

async function testCloseUserDatabase() {
  isClosed = true;
  await act(async () => {
    await closeUserDatabase();
  });
}

describe("User Database Isolation integration tests", () => {
  beforeEach(() => {
    delayDatabaseOpen = false;
    openPromiseResolve = null;
    isClosed = false;
  });

  afterAll(() => {
    const dbDir = path.join(__dirname, "test-dbs-isolation");
    if (fs.existsSync(dbDir)) {
      fs.rmSync(dbDir, { recursive: true, force: true });
    }
  });

  it("isolates Account A's deck from Account B, and allows Account A to see it again on re-login", async () => {
    // 1. Log in as user-a
    const managerA = testCreateUserDatabaseManager("user-a");
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
    await testCloseUserDatabase();

    // 2. Log in as user-b
    const managerB = testCreateUserDatabaseManager("user-b");
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
    await testCloseUserDatabase();

    // 3. Log back in as user-a
    const managerA2 = testCreateUserDatabaseManager("user-a");
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
    await testCloseUserDatabase();
  });

  it("keeps two non-BMP ids that share a UTF-16 surrogate isolated (db-name collision regression)", async () => {
    // 😀 (U+1F600) and 😁 (U+1F601) share the high surrogate D83D. A
    // charCodeAt(0)-based db name collapses both to one file and silently
    // merges the two accounts; full UTF-8 byte encoding keeps them apart.
    const managerA = testCreateUserDatabaseManager("😀");
    await managerA.init();

    const { result: storeA } = renderHook(() => useStore(), {
      wrapper: ({ children }) => (
        <DatabaseProvider manager={managerA}>{children}</DatabaseProvider>
      ),
    });
    await waitFor(() => expect(storeA.current.status).toBe("ready"));

    let deckId = "";
    await act(async () => {
      const deck = await storeA.current.createDeck("Astral Deck", "shared-surrogate user");
      deckId = deck.id;
    });
    await waitFor(() => expect(storeA.current.decks.map((d) => d.id)).toContain(deckId));

    await testCloseUserDatabase();

    // A different id that would collide under the old encoding.
    const managerB = testCreateUserDatabaseManager("😁");
    await managerB.init();

    const { result: storeB } = renderHook(() => useStore(), {
      wrapper: ({ children }) => (
        <DatabaseProvider manager={managerB}>{children}</DatabaseProvider>
      ),
    });
    await waitFor(() => expect(storeB.current.status).toBe("ready"));

    // Distinct db files ⇒ account B never sees account A's deck.
    expect(storeB.current.decks.map((d) => d.id)).not.toContain(deckId);
    expect(storeB.current.decks).toHaveLength(0);

    await testCloseUserDatabase();
  });

  it("prevents further queries/writes through the old manager after logout", async () => {
    const manager = testCreateUserDatabaseManager("user-a");
    await manager.init();

    const { result: store } = renderHook(() => useStore(), {
      wrapper: ({ children }) => (
        <DatabaseProvider manager={manager}>{children}</DatabaseProvider>
      ),
    });
    await waitFor(() => expect(store.current.status).toBe("ready"));

    // Logout closes database
    await testCloseUserDatabase();

    // Attempts to write through the old manager/database should throw/fail
    await expect(store.current.createDeck("Spanish", "")).rejects.toThrow();
  });

  it("aborts database opening if closed during a delayed initialization", async () => {
    // Set delay flag
    delayDatabaseOpen = true;

    const manager = testCreateUserDatabaseManager("user-a");

    // Start initialization, which will be stuck opening
    const initPromise = manager.init();

    // Verify manager status is loading
    expect(manager.state.status).toBe("loading");

    // Call logout/close before opening completes
    await testCloseUserDatabase();

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
    // 1. First session: user-a
    const managerA = testCreateUserDatabaseManager("user-a");
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
    await testCloseUserDatabase();

    // 3. Open user-b's database
    const managerB = testCreateUserDatabaseManager("user-b");
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
    await testCloseUserDatabase();
  });
});
