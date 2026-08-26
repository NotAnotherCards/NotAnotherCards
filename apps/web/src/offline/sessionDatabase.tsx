import { createContext, useContext, type ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { DatabaseManager, SyncController } from '@remelondb/core';
import {
  DatabaseProvider,
  useSessionDatabase as useOwnedDatabase,
} from '@remelondb/core/react';
import { authClient } from '@/lib/auth-client';
import { createUserDatabaseManager } from './db';
import { pullChanges, pushChanges } from './sync';
import { browserSyncTriggers } from './syncController';

type SessionDatabase = {
  manager: DatabaseManager | null;
  syncController: SyncController | null;
};

const SessionDatabaseContext = createContext<SessionDatabase | null>(null);

/**
 * One database per signed-in account, opened and closed with the
 * session. The lifecycle is remelonDB's useSessionDatabase; this
 * supplies the browser pieces and puts the result on context.
 *
 * It is mounted in `routes/__root.tsx`, above every route, and that
 * placement is required rather than tidy: the hook's close queue lives
 * as long as the component calling it, and TanStack destroys and
 * recreates a route layout faster than a close finishes. Mounted inside
 * `/app`, the queue would be empty again on every navigation and the
 * next open would have nothing to wait for.
 */
export function SessionDatabaseProvider({ children }: { children: ReactNode }) {
  const { data: session, isPending } = authClient.useSession();
  // Only a settled session, and only one that has finished onboarding.
  // The database used to be opened by the `/app` layout, which sits
  // behind a guard that checks both; from the root there is no guard in
  // front, so the condition moves here. A user still on `/onboarding`
  // has no profile yet and no reason to open a database.
  const userId =
    !isPending && session?.user.onBoardingComplete ? session.user.id : null;

  const { manager, syncController, closeError } = useOwnedDatabase({
    userId,
    createManager: createUserDatabaseManager,
    sync: { pullChanges, pushChanges },
    controller: { triggers: browserSyncTriggers },
  });

  if (closeError) {
    return <DatabaseUnrecoverable error={closeError} />;
  }

  // Render the tree either way: the manager arrives from an effect, and
  // blanking here would unmount the router on every authenticated first
  // paint. Consumers read it through useSessionDatabase, which is
  // null-safe.
  const content = manager ? (
    <DatabaseProvider manager={manager}>{children}</DatabaseProvider>
  ) : (
    children
  );

  return (
    <SessionDatabaseContext.Provider value={{ manager, syncController }}>
      {content}
    </SessionDatabaseContext.Provider>
  );
}

/**
 * A close that failed leaves the database possibly still open, so the
 * hook refuses to open another over the same file and keeps refusing.
 * Navigation cannot clear it, and there is no database to provide, so
 * this replaces the tree rather than sitting inside it.
 */
function DatabaseUnrecoverable({ error }: { error: Error }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center">
      <AlertCircle className="size-8 text-destructive" />
      <h1 className="text-lg font-semibold text-foreground">
        Reload to continue
      </h1>
      <p className="max-w-md text-sm text-muted-foreground">
        The offline database could not be closed, so it is not safe to open it
        again on this page.
      </p>
      <p className="max-w-md text-xs text-muted-foreground">{error.message}</p>
      <Button onClick={() => window.location.reload()}>
        <RefreshCw />
        Reload
      </Button>
    </div>
  );
}

export function useSessionDatabase(): SessionDatabase {
  const value = useContext(SessionDatabaseContext);
  if (!value) {
    // A default of nulls here would turn a missing provider into a
    // permanently blank page, since the layout renders nothing without
    // a manager. Fail where the mistake is.
    throw new Error('useSessionDatabase requires SessionDatabaseProvider');
  }
  return value;
}
