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
import { authClient } from './auth-client';
import { createUserDatabaseManager } from './db';

type OwnedManager = {
  userId: string;
  manager: DatabaseManager;
};

type SessionDatabase = {
  manager: DatabaseManager | null;
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
      void owned?.manager.close();
      return;
    }

    const manager = createUserDatabaseManager(userId);
    const owned = { userId, manager };
    ownedManagerRef.current = owned;
    setOwnedManager(owned);

    manager.init().catch((error: unknown) => {
      if (ownedManagerRef.current === owned) {
        console.error('opening the offline database failed', error);
      }
    });

    return () => {
      if (ownedManagerRef.current === owned) {
        ownedManagerRef.current = null;
      }
      // Not awaited: on an account switch the next effect opens the new
      // user's file while this one is still closing, which is safe only
      // because the files differ. Anything that must finish before the
      // close (aborting an in-flight sync, #148) goes above this line.
      void manager.close();
    };
  }, [userId]);

  const activeManager =
    ownedManager?.userId === userId ? ownedManager.manager : null;
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
    <SessionDatabaseContext.Provider value={{ manager: activeManager }}>
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
