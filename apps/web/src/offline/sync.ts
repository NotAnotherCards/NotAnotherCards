import { synchronize, type Database } from "@remelondb/core";
import { syncWireSchemas } from "@repo/offline-db";
import type {
  SyncPullArgs,
  SyncPullResult,
  SyncPushArgs,
  SyncPushResult,
} from "@remelondb/core";

/**
 * Transport for the authenticated sync endpoints (#52). Protocol
 * outcomes (`conflict`, `resyncRequired`, per-record rejections) arrive
 * as HTTP 200 and pass through to `synchronize`. Everything else —
 * 401, 5xx, malformed or wire-invalid bodies, network failures — is a
 * SyncTransportError: the sync run fails, local dirty state stays.
 */
export class SyncTransportError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "SyncTransportError";
  }
}

async function post(path: "pull" | "push", body: unknown): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(`/sync/${path}`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (error) {
    throw new SyncTransportError(`sync ${path}: network failure (${String(error)})`);
  }
  if (!response.ok) {
    throw new SyncTransportError(
      `sync ${path}: HTTP ${response.status}`,
      response.status,
    );
  }
  try {
    return await response.json();
  } catch {
    throw new SyncTransportError(`sync ${path}: malformed response body`);
  }
}

export async function pullChanges(args: SyncPullArgs): Promise<SyncPullResult> {
  const raw = await post("pull", args);
  const parsed = syncWireSchemas.pullResult.safeParse(raw);
  if (!parsed.success) {
    throw new SyncTransportError(`sync pull: invalid wire shape (${parsed.error.issues[0]?.message ?? "unknown"})`);
  }
  return parsed.data as SyncPullResult;
}

export async function pushChanges(args: SyncPushArgs): Promise<SyncPushResult> {
  const raw = await post("push", args);
  const parsed = syncWireSchemas.pushResult.safeParse(raw);
  if (!parsed.success) {
    throw new SyncTransportError(`sync push: invalid wire shape (${parsed.error.issues[0]?.message ?? "unknown"})`);
  }
  return parsed.data as SyncPushResult;
}

/**
 * One synchronization run against the authenticated endpoints.
 * remelonDB handles `resyncRequired` internally with a replacement
 * pull and reports it in the run's result. The optional signal lets a
 * logout abort a sync that is still in flight.
 */
export function createRunSync(database: Database) {
  return async (signal?: AbortSignal): Promise<{ resynced: boolean }> => {
    const result = await synchronize({
      database,
      pullChanges,
      pushChanges,
      ...(signal ? { signal } : {}),
    });
    return { resynced: result.resynced };
  };
}
