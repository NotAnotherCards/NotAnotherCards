import type { Database } from '@remelondb/core';
import { createRunSync as createSharedRunSync } from '@remelondb/core';
import { createAppSyncTransport, createHttpPost } from '@repo/offline-db';

export { SyncTransportError } from '@repo/offline-db';

// Web authentication is the browser's cookie jar; relative URLs keep the
// requests same-origin. Everything else comes from remelonDB.
export const { pullChanges, pushChanges } = createAppSyncTransport(
  createHttpPost({ baseUrl: '', credentials: 'include' }),
);

export function createRunSync(database: Database) {
  return createSharedRunSync({ database, pullChanges, pushChanges });
}
