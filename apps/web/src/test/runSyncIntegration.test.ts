/**
 * createRunSync against the real remelonDB synchronize (#52). The
 * resync detection works by regexing core's log output — a
 * cross-package string coupling. If a remelondb release rewords its
 * resync log line, the second test goes red instead of the resync
 * banner silently disappearing in production.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { Database } from "@remelondb/core";
import { NodeSqliteDriver } from "@remelondb/driver-node";
import { schema, UserDeck, UserCard, ReviewEvent } from "@repo/offline-db";
import { createRunSync } from "../offline/sync";
import { createDeck } from "../offline/queries";

const emptyChanges = {
  user_decks: { created: [], updated: [], deleted: [] },
  user_cards: { created: [], updated: [], deleted: [] },
  review_events: { created: [], updated: [], deleted: [] },
};

const openDb = () =>
  Database.open({
    driver: new NodeSqliteDriver(),
    schema,
    modelClasses: [UserDeck, UserCard, ReviewEvent],
    name: ":memory:",
  });

const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

afterEach(() => vi.unstubAllGlobals());

describe("createRunSync against the real synchronize", () => {
  it("an ordinary run reports resynced: false", async () => {
    const db = await openDb();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: RequestInfo | URL) =>
        String(url).endsWith("/pull")
          ? json({ cursor: "1", changes: emptyChanges })
          : json({ cursor: null, changes: null }),
      ),
    );

    expect(await createRunSync(db)()).toEqual({ resynced: false });
    await db.driver.close();
  });

  it("a server resyncRequired surfaces as resynced: true", async () => {
    const db = await openDb();
    // a dirty record so the run has something to push after recovery
    await createDeck(db, "Pre-reset deck");

    let pulls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: RequestInfo | URL) => {
        if (String(url).endsWith("/pull")) {
          pulls += 1;
          return pulls === 1
            ? json({ resyncRequired: true })
            : json({ cursor: "2", changes: emptyChanges });
        }
        return json({ cursor: null, changes: null });
      }),
    );

    expect(await createRunSync(db)()).toEqual({ resynced: true });
    // recovery means a replacement pull actually happened
    expect(pulls).toBeGreaterThanOrEqual(2);
    await db.driver.close();
  });
});
