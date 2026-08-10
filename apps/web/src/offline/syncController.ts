import { SyncTransportError } from "./sync";

/**
 * One sync controller per authenticated database (#52). Local writes
 * never wait for the network: the controller runs `synchronize` in the
 * background — single flight, triggers coalesced — and exposes status
 * for the UI. `dispose()` is the logout hard-stop.
 *
 * `resync-required` is the post-recovery notice: remelonDB handles a
 * server `resyncRequired` internally (replacement re-pull), and the
 * injected run reports it happened so the UI can say so; the next
 * successful ordinary sync clears it.
 */
export type SyncStatus =
  | "idle"
  | "syncing"
  | "offline"
  | "error"
  | "resync-required";

export interface SyncControllerState {
  readonly status: SyncStatus;
  readonly lastSyncAt: number | null;
  readonly error: string | null;
}

export interface SyncControllerOptions {
  /** Run one synchronization; reports whether a replacement resync
   * happened. Throws SyncTransportError on transport failure. */
  readonly runSync: () => Promise<{ resynced: boolean }>;
  readonly intervalMs?: number;
  readonly debounceMs?: number;
}

export interface SyncController {
  readonly state: SyncControllerState;
  subscribe(listener: (state: SyncControllerState) => void): () => void;
  /** Begin: initial sync, then interval/online/visibility triggers. */
  start(): void;
  /** A local write happened; sync soon (debounced). */
  notifyLocalWrite(): void;
  /** Manual trigger; also re-arms after a 401. */
  syncNow(): void;
  /** Stop everything, forever. The logout/account-change path. */
  dispose(): void;
}

export function createSyncController(
  options: SyncControllerOptions,
): SyncController {
  const intervalMs = options.intervalMs ?? 60_000;
  const debounceMs = options.debounceMs ?? 2_000;

  let state: SyncControllerState = {
    status: "idle",
    lastSyncAt: null,
    error: null,
  };
  const listeners = new Set<(state: SyncControllerState) => void>();
  let disposed = false;
  let running = false;
  let rerunQueued = false;
  let authBlocked = false;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let intervalTimer: ReturnType<typeof setInterval> | null = null;

  const setState = (next: Partial<SyncControllerState>): void => {
    state = { ...state, ...next };
    for (const listener of [...listeners]) {
      listener(state);
    }
  };

  const run = (): void => {
    if (disposed || running) {
      rerunQueued = running ? true : rerunQueued;
      return;
    }
    running = true;
    setState({ status: "syncing" });
    options
      .runSync()
      .then(
        (result) => {
          if (disposed) return;
          setState({
            status: result.resynced ? "resync-required" : "idle",
            lastSyncAt: Date.now(),
            error: null,
          });
        },
        (error: unknown) => {
          if (disposed) return;
          const transport =
            error instanceof SyncTransportError ? error : null;
          if (transport?.status === 401) {
            // the session is gone: stop the machinery, the auth layer
            // owns what happens next; a manual retry re-arms
            authBlocked = true;
            setState({ status: "error", error: transport.message });
            return;
          }
          if (transport && transport.status === undefined) {
            setState({ status: "offline", error: transport.message });
            return;
          }
          setState({ status: "error", error: String(error) });
        },
      )
      .finally(() => {
        running = false;
        if (rerunQueued && !disposed) {
          rerunQueued = false;
          run();
        }
      });
  };

  const autoTrigger = (): void => {
    if (disposed || authBlocked) return;
    run();
  };

  const onOnline = (): void => autoTrigger();
  const onVisibility = (): void => {
    if (document.visibilityState === "visible") autoTrigger();
  };

  return {
    get state() {
      return state;
    },
    subscribe(listener) {
      listeners.add(listener);
      listener(state);
      return () => listeners.delete(listener);
    },
    start() {
      if (disposed) return;
      window.addEventListener("online", onOnline);
      document.addEventListener("visibilitychange", onVisibility);
      intervalTimer = setInterval(autoTrigger, intervalMs);
      run();
    },
    notifyLocalWrite() {
      if (disposed || authBlocked) return;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        autoTrigger();
      }, debounceMs);
    },
    syncNow() {
      if (disposed) return;
      authBlocked = false; // the human (or a fresh login) re-arms it
      run();
    },
    dispose() {
      disposed = true;
      if (debounceTimer) clearTimeout(debounceTimer);
      if (intervalTimer) clearInterval(intervalTimer);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisibility);
      listeners.clear();
    },
  };
}
