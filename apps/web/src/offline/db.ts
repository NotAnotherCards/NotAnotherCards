import { createDatabaseManager, Database } from "@remelondb/core";
import type { DatabaseManagerState } from "@remelondb/core";
import { WebSqliteDriver } from "@remelondb/driver-web";
import { schema, UserDeck, UserCard, ReviewEvent } from "@repo/offline-db";

export type { DatabaseManagerState as DatabaseState };

export const manager = createDatabaseManager({
  open: (onTakenOver) =>
    Database.open({
      driver: new WebSqliteDriver({
        shared: false,
        takeover: true,
        onTakenOver,
      }),
      schema,
      modelClasses: [UserDeck, UserCard, ReviewEvent],
      name: "notanothercards.db",
    }),
});
