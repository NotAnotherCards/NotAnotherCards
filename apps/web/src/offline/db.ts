import { createDatabaseManager, Database } from "@remelondb/core";
import type { DatabaseManagerState } from "@remelondb/core";
import { WebSqliteDriver } from "@remelondb/driver-web";
import { schema, UserDeck, UserCard, ReviewEvent } from "@repo/offline-db";

export type { DatabaseManagerState as DatabaseState };

export const manager = createDatabaseManager({
  open: (onTakenOver) => {
    async function attemptOpen(retriesLeft = 3, delayMs = 350): Promise<Database> {
      try {
        return await Database.open({
          driver: new WebSqliteDriver({
            shared: false,
            takeover: true,
            onTakenOver,
          }),
          schema,
          modelClasses: [UserDeck, UserCard, ReviewEvent],
          name: "notanothercards.db",
        });
      } catch (err) {
        if (retriesLeft <= 1) throw err;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        return attemptOpen(retriesLeft - 1, delayMs);
      }
    }
    return attemptOpen();
  },
});
