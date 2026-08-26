import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { DatabaseManager } from '@remelondb/core';
import { DatabaseProvider } from '@remelondb/core/react';
import {
  createRunSync,
  createSyncController,
  type SyncController,
} from '@remelondb/core';
import { authClient } from './auth-client';
import { createUserDatabaseManager } from './db';
import { pullChanges, pushChanges } from './sync';
import { nativeSyncTriggers } from './sync-triggers';

type OwnedManager = {
  userId: string;
  manager: DatabaseManager;
  syncController: SyncController | null;
};

type SessionDatabase = {
  manager: DatabaseManager | null;
  syncController: SyncController | null;
};

const SessionDatabaseContext = createContext<SessionDatabase | null>(null);

// Closes run one after another, and an open waits for the chain, so the
// file is never opened and closed at the same time. The chain never
// rejects: a close that throws must not strand every later open behind a
// rejected promise.
const chainClose = (
  pending: Promise<void>,
  manager: DatabaseManager,
): Promise<void> => pending.then(() => manager.close()).catch(() => {});

export function SessionDatabaseProvider({ children }: { children: ReactNode }) {
  const { data: session, isPending } = authClient.useSession();
  const userId = isPending ? null : (session?.user.id ?? null);
  const [ownedManager, setOwnedManager] = useState<OwnedManager | null>(null);
  const ownedManagerRef = useRef<OwnedManager | null>(null);
  const pendingCloseRef = useRef<Promise<void>>(Promise.resolve());

  // The only place the database is closed. Logout and account switch both
  // arrive here as a session change; nothing else should call close().
  useEffect(() => {
    if (!userId) {
      const owned = ownedManagerRef.current;
      ownedManagerRef.current = null;
      setOwnedManager(null);
      owned?.syncController?.dispose();
      if (owned) {
        pendingCloseRef.current = chainClose(
          pendingCloseRef.current,
          owned.manager,
        );
      }
      return;
    }

    const manager = createUserDatabaseManager(userId);
    const owned: OwnedManager = { userId, manager, syncController: null };
    ownedManagerRef.current = owned;
    setOwnedManager(owned);

    // Sync attaches whenever the database is open, not only to the init()
    // below: the banner's Retry calls init() on the manager directly, and
    // a database recovered that way needs sync just as much.
    const unsubscribe = manager.subscribe((state) => {
      if (ownedManagerRef.current !== owned) return;
      // Cleanup closes over `owned`, so keep the controller on that object.
      // Clone only for React, which needs a new reference to re-render.
      if (state.status !== 'ready') {
        // Left ready: the Database this controller holds is gone, and a
        // reopen builds a new one. Drop it so the next ready attaches.
        if (!owned.syncController) return;
        owned.syncController.dispose();
        owned.syncController = null;
        setOwnedManager({ ...owned });
        return;
      }
      if (owned.syncController) return;
      const controller = createSyncController({
        runSync: createRunSync({
          database: manager.database,
          pullChanges,
          pushChanges,
        }),
        triggers: nativeSyncTriggers,
      });
      owned.syncController = controller;
      setOwnedManager({ ...owned });
      controller.start();
    });

    // Opens queue behind the previous close. A re-login as the same account
    // reuses one SQLite file, so overlapping the close with the next open
    // would race on disk.
    const opened = pendingCloseRef.current.then(() => {
      if (ownedManagerRef.current !== owned) return;
      return manager.init();
    });
    opened.catch((error: unknown) => {
      if (ownedManagerRef.current === owned) {
        console.error('opening the offline database failed', error);
      }
    });

    return () => {
      if (ownedManagerRef.current === owned) {
        ownedManagerRef.current = null;
      }
      unsubscribe();
      // Dispose aborts an in-flight sync (#148) and must run before the
      // close below.
      owned.syncController?.dispose();
      pendingCloseRef.current = chainClose(pendingCloseRef.current, manager);
    };
  }, [userId]);

  const active = ownedManager?.userId === userId ? ownedManager : null;
  const activeManager = active?.manager ?? null;
  // Render the tree either way. The manager is created in an effect, so an
  // authenticated first paint has no manager yet; blanking here would unmount
  // the navigator, including the unauthenticated screens. Consumers reach the
  // manager through useSessionDatabase, which is null-safe.
  const content = activeManager ? (
    <DatabaseProvider manager={activeManager}>{children}</DatabaseProvider>
  ) : (
    children
  );

  return (
    <SessionDatabaseContext.Provider
      value={{
        manager: activeManager,
        syncController: active?.syncController ?? null,
      }}
    >
      {content}
    </SessionDatabaseContext.Provider>
  );
}

export function useSessionDatabase(): SessionDatabase {
  const value = useContext(SessionDatabaseContext);
  if (!value) {
    throw new Error('useSessionDatabase requires SessionDatabaseProvider');
  }
  return value;
}
