import { describe, expect, it, vi } from "vitest";
import { Database } from "@remelondb/core";
import { schema, UserDeck, UserCard, ReviewEvent } from "@repo/offline-db";
import "../offline/db"; // triggers createDatabaseManager — sets capturedOpen via the mock below

// Capture the open callback that db.ts passes to createDatabaseManager.
// Must be `var` — vi.mock factories are hoisted before let/const are initialized (TDZ).
// eslint-disable-next-line no-var
var capturedOpen: ((onTakenOver: () => void) => Promise<Database>) | undefined;

vi.mock("@remelondb/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@remelondb/core")>();
  return {
    ...actual,
    createDatabaseManager: vi.fn((options) => {
      capturedOpen = options.open;
      return {
        state: { status: "idle", error: null },
        init: vi.fn().mockResolvedValue({}),
        subscribe: vi.fn(() => () => {}),
        get database(): never {
          throw new Error("not open");
        },
      };
    }),
    Database: {
      ...actual.Database,
      open: vi.fn().mockResolvedValue({ driver: { close: vi.fn() } }),
    },
  };
});

vi.mock("@remelondb/driver-web", () => ({
  WebSqliteDriver: vi.fn().mockImplementation(() => ({})),
}));

describe("database manager configuration", () => {
  it("calls Database.open with the correct schema, model classes, and name", async () => {
    // db.ts runs createDatabaseManager at module-load time — capturedOpen is set by then
    expect(capturedOpen).toBeDefined();
    await capturedOpen!(() => {});

    expect(Database.open).toHaveBeenCalledWith(
      expect.objectContaining({
        schema,
        modelClasses: [UserDeck, UserCard, ReviewEvent],
        name: "notanothercards.db",
      }),
    );
  });
});
