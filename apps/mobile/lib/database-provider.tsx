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

export function SessionDatabaseProvider({ children }: { children: ReactNode }) {
  const { data: session, isPending } = authClient.useSession();
  const userId = isPending ? null : (session?.user.id ?? null);
  const [ownedManager, setOwnedManager] = useState<OwnedManager | null>(null);
  const ownedManagerRef = useRef<OwnedManager | null>(null);

  // The only place the database is closed. Logout and account switch both
  // arrive here as a session change; nothing else should call close().
  useEffect(() => {
    if (!userId) {
      const owned = ownedManagerRef.current;
      ownedManagerRef.current = null;
      setOwnedManager(null);
      owned?.syncController?.dispose();
      void owned?.manager.close();
      return;
    }

    const manager = createUserDatabaseManager(userId);
    const owned: OwnedManager = { userId, manager, syncController: null };
    ownedManagerRef.current = owned;
    setOwnedManager(owned);

    manager
      .init()
      .then((database) => {
        // Sync starts only once this user's database is open, and only if
        // this session is still the active one.
        if (ownedManagerRef.current !== owned || !database) return;
        const controller = createSyncController({
          runSync: createRunSync({ database, pullChanges, pushChanges }),
          triggers: nativeSyncTriggers,
        });
        owned.syncController = controller;
        setOwnedManager({ ...owned });
        controller.start();
      })
      .catch((error: unknown) => {
        if (ownedManagerRef.current === owned) {
          console.error('opening the offline database failed', error);
        }
      });

    return () => {
      if (ownedManagerRef.current === owned) {
        ownedManagerRef.current = null;
      }
      // Dispose aborts an in-flight sync (#148) and must run before the
      // close below. The close is not awaited: on an account switch the
      // next effect opens the new user's file while this one is still
      // closing, which is safe only because the files differ.
      owned.syncController?.dispose();
      void manager.close();
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
