import { createSyncTransport, type SyncPost } from '@remelondb/core/transport';
import { syncWireSchemas } from './index.js';

export {
  createHttpPost,
  readSyncResponse,
  SyncTransportError,
  type SyncPath,
  type SyncPost,
} from '@remelondb/core/transport';

/**
 * The app's sync transport: remelonDB's classification and wire
 * validation bound to our schemas, over a platform-supplied `post`.
 * Request authentication is the platform's job and lives in that post
 * (the browser's cookie jar on web, an explicit Cookie header on
 * native).
 */
export function createAppSyncTransport(post: SyncPost) {
  return createSyncTransport({
    post,
    validatePullResult: (raw) => syncWireSchemas.pullResult.parse(raw),
    validatePushResult: (raw) => syncWireSchemas.pushResult.parse(raw),
  });
}
