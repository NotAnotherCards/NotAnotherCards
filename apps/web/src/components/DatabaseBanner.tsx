import { AlertCircle, RefreshCw, Loader2 } from "lucide-react";
import { useDatabaseState } from "@remelondb/core/react";

// Storage denied by the browser (private browsing, "never remember
// history", blocked site data): remelondb >=0.1.8 fails fast with a
// typed code; the message fallback covers errors relayed as plain text.
function isOpfsBlocked(error: Error | null): boolean {
  if (!error) return false;
  return (
    (error as { code?: string }).code === "OPFS_UNAVAILABLE" ||
    /OPFS storage is unavailable/i.test(error.message)
  );
}

function getFriendlyErrorMessage(error: Error | null): string {
  if (!error) return "Failed to load database.";
  if (error.message.includes("shared worker did not answer")) {
    return "Database connection timed out. Please retry or refresh the page.";
  }
  return error.message;
}

export function DatabaseBanner() {
  const { status, error } = useDatabaseState();

  if (status === "ready" || status === "idle") {
    return null;
  }

  const handleReconnect = () => {
    window.location.reload();
  };

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-xl px-4 pointer-events-none select-none animate-in fade-in slide-in-from-top-4 duration-300">
      <div className="bg-background/95 backdrop-blur-xs border border-border/80 rounded-2xl shadow-lg overflow-hidden pointer-events-auto">
        {status === "loading" && (
          <div className="bg-blue-500/10 border-blue-500/20 text-blue-800 px-4 py-3.5 flex items-center gap-2.5 text-xs">
            <Loader2 className="size-4 animate-spin text-blue-500 shrink-0" />
            <span>
              <strong>Connecting Database:</strong> Reclaiming and initializing local offline storage...
            </span>
          </div>
        )}
        {status === "taken-over" && (
          <div className="bg-amber-500/10 border-amber-500/20 dark:text-amber-300 px-4 py-3.5 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <AlertCircle className="size-4 text-amber-500 shrink-0" />
              <span>
                <strong>Offline Database Inactive:</strong> This application is
                open in another tab. Offline features are disabled here.
              </span>
            </div>
            <button
              onClick={handleReconnect}
              className="flex items-center gap-1.5 px-3 py-1 rounded text-white font-medium hover:bg-amber-600 active:bg-amber-700 transition-colors text-[10px] cursor-pointer shadow-sm shrink-0"
            >
              <RefreshCw className="size-3" />
              Use here instead
            </button>
          </div>
        )}

        {status === "error" && isOpfsBlocked(error) && (
          <div className="bg-amber-500/10 border-amber-500/20 dark:text-amber-300 px-4 py-3.5 flex items-center gap-2 text-xs">
            <AlertCircle className="size-4 text-amber-500 shrink-0" />
            <span>
              <strong>Storage blocked:</strong> this browser blocks site
              storage (private browsing or blocked site data), so your decks
              cannot be loaded. Allow site data for this site or use a normal
              window.
            </span>
          </div>
        )}

        {status === "error" && !isOpfsBlocked(error) && (
          <div className="bg-destructive/10 border-destructive/20 dark:text-red-400 px-4 py-3.5 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <AlertCircle className="size-4 text-destructive shrink-0" />
              <span>
                <strong>Offline Database Error:</strong>{" "}
                {getFriendlyErrorMessage(error)}
              </span>
            </div>
            <button
              onClick={handleReconnect}
              className="flex items-center gap-1.5 px-3 py-1 rounded text-destructive-foreground font-medium hover:bg-destructive/90 active:bg-destructive transition-colors text-[10px] cursor-pointer shadow-sm shrink-0"
            >
              <RefreshCw className="size-3" />
              Retry
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
