import { beforeEach, describe, expect, it, vi } from "vitest";
import { Database } from "@remelondb/core";

type ManagerOptions = {
  open: (onTakenOver: () => void) => Promise<unknown>;
};

type ProposedDatabaseModule = {
  createUserDatabaseManager?: (userId: string) => unknown;
  closeUserDatabase?: () => Promise<void>;
};

// `var` is intentional: Vitest hoists mock factories before lexical variable
// initialization. createDatabaseManager is called later, when db.ts loads.
// eslint-disable-next-line no-var
var capturedManagers: ManagerOptions[] = [];

vi.mock("@remelondb/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@remelondb/core")>();
  return {
    ...actual,
    createDatabaseManager: vi.fn((options: ManagerOptions) => {
      capturedManagers.push(options);
      return {
        state: { status: "idle", error: null },
        init: vi.fn(),
        subscribe: vi.fn(() => () => {}),
        close: vi.fn(async () => {}),
      };
    }),
    Database: {
      ...actual.Database,
      open: vi.fn().mockResolvedValue({ driver: { close: vi.fn() } }),
    },
  };
});

vi.mock("@remelondb/driver-web", () => ({
  WebSqliteDriver: class {},
}));

const loadSubject = () =>
  import("../offline/db") as Promise<ProposedDatabaseModule>;

function requireFactory(module: ProposedDatabaseModule) {
  expect(
    module.createUserDatabaseManager,
    "db.ts should export createUserDatabaseManager(userId)",
  ).toBeTypeOf("function");
  return module.createUserDatabaseManager!;
}

async function openedNames() {
  for (const manager of capturedManagers) {
    await manager.open(() => {});
  }
  return vi
    .mocked(Database.open)
    .mock.calls.map(([options]) => options.name as string);
}

describe("authenticated user database configuration", () => {
  beforeEach(() => {
    vi.resetModules();
    capturedManagers = [];
    vi.mocked(Database.open).mockClear();
  });

  it("does not create a database manager before an authenticated user is known", async () => {
    await loadSubject();

    expect(capturedManagers).toHaveLength(0);
    expect(Database.open).not.toHaveBeenCalled();
  });

  it("uses a stable, filename-safe database name for the same user", async () => {
    const factory = requireFactory(await loadSubject());

    factory("../../alice@example.com");
    factory("../../alice@example.com");

    const names = await openedNames();
    expect(names[0]).toBe(names[1]);
    expect(names[0]).toMatch(/^[A-Za-z0-9._-]+\.db$/);
    expect(names[0]).not.toBe("notanothercards.db");
    expect(names[0]).not.toContain("alice@example.com");
  });

  it("uses different databases for different authenticated users", async () => {
    const factory = requireFactory(await loadSubject());

    factory("user-a");
    factory("user-b");

    const names = await openedNames();
    expect(names[0]).not.toBe(names[1]);
  });

  it("preserves the shared schema and model configuration", async () => {
    const factory = requireFactory(await loadSubject());

    factory("user-a");
    await capturedManagers[0].open(() => {});

    const call = vi.mocked(Database.open).mock.calls[0][0];
    expect(call.schema).toBeDefined();
    expect(call.modelClasses!.map((c: { name: string }) => c.name)).toEqual([
      "UserDeck",
      "UserCard",
      "ReviewEvent",
    ]);
  });

  it("never derives the legacy shared database name for any user", async () => {
    const factory = requireFactory(await loadSubject());

    for (const userId of ["user-a", "notanothercards", "local", ""]) {
      factory(userId);
    }

    for (const name of await openedNames()) {
      expect(name).not.toBe("notanothercards.db");
    }
  });

  it("forgets the active manager on close: the next login starts fresh", async () => {
    const module = await loadSubject();
    const factory = requireFactory(module);
    expect(
      module.closeUserDatabase,
      "db.ts should export closeUserDatabase()",
    ).toBeTypeOf("function");

    factory("user-a");
    await module.closeUserDatabase!();

    // same account logging back in must get a new manager, not a stale
    // reference kept across the logout
    factory("user-a");
    expect(capturedManagers).toHaveLength(2);
  });
});
