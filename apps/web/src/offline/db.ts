import { createDatabaseManager, Database } from "@remelondb/core";
import type { DatabaseManager, DatabaseManagerState } from "@remelondb/core";
import { WebSqliteDriver } from "@remelondb/driver-web";
import { schema, UserDeck, UserCard, ReviewEvent } from "@repo/offline-db";
import { useSyncExternalStore } from "react";

export type { DatabaseManagerState as DatabaseState };

export const manager = createDatabaseManager({
  open: (onTakenOver) =>
    Database.open({
      driver: new WebSqliteDriver({ shared: true, takeover: true, onTakenOver }),
      schema,
      modelClasses: [UserDeck, UserCard, ReviewEvent],
      name: "notanothercards.db",
    }),
});

/**
 * React hook — matches the @remelondb/core/react API shape.
 * Swap for "import { useDatabaseState } from '@remelondb/core/react'"
 * once that subpath ships in a published build of core.
 */
export function useDatabaseState(m: DatabaseManager = manager): DatabaseManagerState {
  return useSyncExternalStore(
    (onStoreChange) => m.subscribe(onStoreChange),
    () => m.state,
    () => m.state,
  );
}
