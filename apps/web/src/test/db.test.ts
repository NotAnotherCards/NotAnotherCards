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

vi.mock("@remelondb/driver-web", () => {
  class WebSqliteDriverMock {
    open = vi.fn();
    close = vi.fn();
  }
  return {
    WebSqliteDriver: WebSqliteDriverMock,
  };
});

describe("dbManager bootstrap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
