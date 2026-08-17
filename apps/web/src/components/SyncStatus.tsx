import { useSyncController, useSyncState } from "@/offline/syncProvider";

const LABELS: Record<string, string> = {
  idle: "Synced",
  syncing: "Syncing…",
  offline: "Offline — changes will sync later",
  error: "Sync failed",
  "resync-required": "Recovered from a server reset",
};

export function SyncStatus() {
  const controller = useSyncController();
  const state = useSyncState();
  if (!controller) {
    // reserve the bar's height while the database opens so the page doesn't
    // shift down when the controller arrives a moment later
    return (
      <div className="px-3 py-1 text-xs" aria-hidden="true">
        &nbsp;
      </div>
    );
  }

  const retryable = state.status === "error" || state.status === "offline";
  return (
    <div
      className="flex items-center gap-2 px-3 py-1 text-xs text-muted-foreground"
      data-testid="sync-status"
    >
      <span
        className={
          state.status === "error"
            ? "text-destructive"
            : state.status === "offline"
              ? "text-amber-600"
              : undefined
        }
      >
        {LABELS[state.status] ?? state.status}
      </span>
      {retryable && (
        <button
          type="button"
          className="underline cursor-pointer"
          onClick={() => controller.syncNow()}
        >
          Retry
        </button>
      )}
    </div>
  );
}
