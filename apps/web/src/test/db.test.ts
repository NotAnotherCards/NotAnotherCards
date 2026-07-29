import { describe, expect, it, vi, beforeEach } from "vitest";
import { dbManager } from "../offline/db";
import { Database } from "@remelondb/core";
import { schema, UserDeck, UserCard, ReviewEvent } from "@repo/offline-db";

vi.mock("@remelondb/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@remelondb/core")>();
  return {
    ...actual,
    Database: {
      ...actual.Database,
      open: vi.fn().mockImplementation(() => Promise.resolve({
        driver: {
          close: vi.fn(),
        },
      })),
    },
  };
});

const mockDriverConstructor = vi.fn();

vi.mock("@remelondb/driver-web", () => {
  return {
    WebSqliteDriver: class {
      constructor(options?: any) {
        mockDriverConstructor(options);
      }
      open = vi.fn();
      close = vi.fn();
    }
  };
});

describe("dbManager bootstrap", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await dbManager.close();
  });

  it("registers the schema and model classes on init", async () => {
    // Mock global navigator for OPFS check
    const originalNavigator = global.navigator;
    Object.defineProperty(global, "navigator", {
      value: {
        storage: {
          getDirectory: vi.fn(),
        },
      },
      writable: true,
      configurable: true,
    });

    await dbManager.init({ storage: "opfs" });

    expect(Database.open).toHaveBeenCalledWith(
      expect.objectContaining({
        schema: schema,
        modelClasses: [UserDeck, UserCard, ReviewEvent],
        name: "ft_transcendence_offline.db",
      })
    );

    // Restore navigator
    Object.defineProperty(global, "navigator", {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
  });

  it("transitions to error state when OPFS is unsupported", async () => {
    const originalNavigator = global.navigator;
    Object.defineProperty(global, "navigator", {
      value: {},
      writable: true,
      configurable: true,
    });

    await expect(dbManager.init({ storage: "opfs" })).rejects.toThrow(
      "Origin Private File System (OPFS) is not supported"
    );

    expect(dbManager.getState().status).toBe("error");
    expect(dbManager.getState().error?.message).toContain("OPFS) is not supported");

    Object.defineProperty(global, "navigator", {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
  });

  it("transitions to taken-over state when onTakenOver callback fires", async () => {
    const originalNavigator = global.navigator;
    Object.defineProperty(global, "navigator", {
      value: {
        storage: {
          getDirectory: vi.fn(),
        },
      },
      writable: true,
      configurable: true,
    });

    await dbManager.init({ storage: "opfs" });
    expect(dbManager.getState().status).toBe("ready");

    expect(mockDriverConstructor).toHaveBeenCalled();
    const calls = mockDriverConstructor.mock.calls;
    const lastCallArgs = calls[calls.length - 1][0];
    const takenOverCallback = lastCallArgs?.onTakenOver;
    expect(takenOverCallback).toBeDefined();

    // Trigger takeover callback
    takenOverCallback!();

    expect(dbManager.getState().status).toBe("taken-over");
    expect(dbManager.getState().error?.message).toContain("Database taken over by another tab");

    Object.defineProperty(global, "navigator", {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
  });
});
