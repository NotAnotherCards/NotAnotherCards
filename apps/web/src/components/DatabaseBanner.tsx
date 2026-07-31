import { manager, useDatabaseState } from "@/offline/db";
import { AlertCircle, RefreshCw } from "lucide-react";

export function DatabaseBanner() {
  const { status, error } = useDatabaseState(manager);

  if (status === "ready" || status === "idle" || status === "loading") {
    return null;
  }

  const handleReconnect = () => {
    manager.init().catch(() => {});
  };

  return (
    <div className="w-full border-b transition-all duration-300">
      {status === "taken-over" && (
        <div className="bg-amber-500/10 border-amber-500/20 text-amber-800 dark:text-amber-300 px-4 py-3 flex items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 text-amber-500 shrink-0" />
            <span>
              <strong>Offline Database Inactive:</strong> This application is
              open in another tab. Offline features are disabled here.
            </span>
          </div>
          <button
            onClick={handleReconnect}
            className="flex items-center gap-1.5 px-3 py-1 rounded bg-amber-500 text-white font-medium hover:bg-amber-600 active:bg-amber-700 transition-colors text-xs cursor-pointer shadow-sm"
          >
            <RefreshCw className="size-3" />
            Use here instead
          </button>
        </div>
      )}

      {status === "error" && (
        <div className="bg-destructive/10 border-destructive/20 text-destructive dark:text-red-400 px-4 py-3 flex items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 text-destructive shrink-0" />
            <span>
              <strong>Offline Database Error:</strong>{" "}
              {error?.message || "Failed to load database."}
            </span>
          </div>
          <button
            onClick={() => manager.init().catch(() => {})}
            className="flex items-center gap-1.5 px-3 py-1 rounded bg-destructive text-destructive-foreground font-medium hover:bg-destructive/90 active:bg-destructive transition-colors text-xs cursor-pointer shadow-sm"
          >
            <RefreshCw className="size-3" />
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
