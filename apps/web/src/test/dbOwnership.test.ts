import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
vi.unmock("@/offline/db");

type StubManager = {
  state: { status: string; error: null };
  init: Mock<() => Promise<unknown>>;
  close: Mock<() => Promise<void>>;
  subscribe: Mock<() => () => void>;
};

// `var` is intentional: Vitest hoists mock factories before lexical variable
// initialization (same pattern as db.test.ts).
// eslint-disable-next-line no-var
var stubManagers: StubManager[] = [];
// eslint-disable-next-line no-var
var syncResolvers: Array<() => void> = [];
// eslint-disable-next-line no-var
var profileRows: unknown[] = [];
// eslint-disable-next-line no-var
var closeFailure: Error | null = null;

vi.mock("@remelondb/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@remelondb/core")>();
  const fakeDb = {
    get: () => ({ query: () => ({ fetch: async () => profileRows }) }),
  };
  return {
    ...actual,
    createDatabaseManager: vi.fn(() => {
      const stub: StubManager = {
        state: { status: "idle", error: null },
        init: vi.fn(async () => {
          stub.state = { status: "ready", error: null };
          return fakeDb;
        }),
        // The real close() resets to idle synchronously at entry, before
        // the driver teardown that can fail. Mirror that so tests see
        // the state a failed close actually leaves behind.
        close: vi.fn(async () => {
          stub.state = { status: "idle", error: null };
          if (closeFailure) {
            throw closeFailure;
          }
        }),
        subscribe: vi.fn(() => () => {}),
      };
      stubManagers.push(stub);
      return stub;
    }),
    synchronize: vi.fn(
      () => new Promise<void>((resolve) => syncResolvers.push(resolve)),
    ),
  };
});

vi.mock("@remelondb/driver-web", () => ({
  WebSqliteDriver: class {},
}));

const loadSubject = () => import("../offline/db");

describe("database manager ownership (issue #140)", () => {
  beforeEach(() => {
    vi.resetModules();
    stubManagers = [];
    syncResolvers = [];
    profileRows = [];
    closeFailure = null;
  });

  it("a stale onboarding check closes only its own manager, never the active one", async () => {
    const db = await loadSubject();

    // A guard on a fresh page load: the empty profile table sends the
    // check into a slow synchronize() that outlives its navigation.
    const staleCheck = db.checkOnboardingComplete("user-a");
    await vi.waitFor(() => expect(syncResolvers).toHaveLength(1));
    const guardManager = stubManagers[0];

    // The navigation is superseded; AppLayout mounts the live manager.
    const active = db.createUserDatabaseManager("user-a");
    const activeStub = stubManagers[1];

    // The abandoned guard's sync finally lands.
    syncResolvers[0]();
    await staleCheck;

    expect(guardManager.close).toHaveBeenCalledTimes(1);
    expect(activeStub.close).not.toHaveBeenCalled();
    expect(db.manager).toBe(active);
  });

  it("concurrent onboarding checks for one user share a single connection", async () => {
    const db = await loadSubject();

    const first = db.checkOnboardingComplete("user-a");
    const second = db.checkOnboardingComplete("user-a");
    expect(stubManagers).toHaveLength(1);

    await vi.waitFor(() => expect(syncResolvers).toHaveLength(1));
    syncResolvers[0]();
    await expect(first).resolves.toBe(false);
    await expect(second).resolves.toBe(false);

    // Once settled, a later check opens (and closes) a fresh connection.
    const third = db.checkOnboardingComplete("user-a");
    expect(stubManagers).toHaveLength(2);
    await vi.waitFor(() => expect(syncResolvers).toHaveLength(2));
    syncResolvers[1]();
    await third;
    expect(stubManagers[1].close).toHaveBeenCalledTimes(1);
  });

  it("a check while a layout manager is active reuses it and leaves it open", async () => {
    // A second open of the same file fails outside shared mode (no
    // SharedWorker on Chrome for Android), so the check must not
    // create a connection of its own here.
    profileRows = [
      {
        username: "sam",
        native_language_id: "en",
        target_language_id: "de",
      },
    ];
    const db = await loadSubject();

    const active = db.createUserDatabaseManager("user-a");
    const activeStub = stubManagers[0];
    await activeStub.init();

    await expect(db.checkOnboardingComplete("user-a")).resolves.toBe(true);

    expect(stubManagers).toHaveLength(1);
    expect(activeStub.close).not.toHaveBeenCalled();
    expect(db.manager).toBe(active);
  });

  it("a check for a different user never adopts the active manager", async () => {
    profileRows = [
      {
        username: "sam",
        native_language_id: "en",
        target_language_id: "de",
      },
    ];
    const db = await loadSubject();

    const active = db.createUserDatabaseManager("user-a");
    const activeStub = stubManagers[0];
    await activeStub.init();

    await expect(db.checkOnboardingComplete("user-b")).resolves.toBe(true);

    expect(stubManagers).toHaveLength(2);
    expect(stubManagers[1].close).toHaveBeenCalledTimes(1);
    expect(activeStub.close).not.toHaveBeenCalled();
    expect(db.manager).toBe(active);
  });

  it("a failed close keeps the global reference, and checks refuse the dead manager", async () => {
    profileRows = [
      {
        username: "sam",
        native_language_id: "en",
        target_language_id: "de",
      },
    ];
    const db = await loadSubject();

    const active = db.createUserDatabaseManager("user-a");
    const activeStub = stubManagers[0];
    await activeStub.init();

    closeFailure = new Error("driver close failed");
    await expect(db.closeUserDatabase()).rejects.toThrow("driver close failed");
    expect(db.manager).toBe(active);

    // The kept manager reads idle; a later check must open its own
    // connection instead of adopting and silently reopening it.
    closeFailure = null;
    await expect(db.checkOnboardingComplete("user-a")).resolves.toBe(true);
    expect(stubManagers).toHaveLength(2);
    expect(stubManagers[1].close).toHaveBeenCalledTimes(1);
    expect(db.manager).toBe(active);
  });

  it("onboarding checks never publish their manager to the global", async () => {
    const db = await loadSubject();

    const check = db.checkOnboardingComplete("user-a");
    expect(db.manager).toBeNull();

    await vi.waitFor(() => expect(syncResolvers).toHaveLength(1));
    syncResolvers[0]();
    await check;
    expect(db.manager).toBeNull();
  });

  it("closing a specific manager clears the global only when it is still active", async () => {
    const db = await loadSubject();

    const first = db.createUserDatabaseManager("user-a");
    const second = db.createUserDatabaseManager("user-a");

    // Closing the displaced first manager leaves the successor active.
    await db.closeUserDatabase(first);
    expect(db.manager).toBe(second);

    // Closing the active manager clears the global.
    await db.closeUserDatabase(second);
    expect(db.manager).toBeNull();
  });
});
