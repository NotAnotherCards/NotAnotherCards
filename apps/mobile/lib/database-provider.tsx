import { createContext, useContext, type ReactNode } from 'react';
import { View } from 'react-native';
import type { DatabaseManager, SyncController } from '@remelondb/core';
import {
  DatabaseProvider,
  useSessionDatabase as useOwnedDatabase,
} from '@remelondb/core/react';
import { authClient } from './auth-client';
import { createUserDatabaseManager } from './db';
import { pullChanges, pushChanges } from './sync';
import { nativeSyncTriggers } from './sync-triggers';
import { Text } from '@/components/ui/text';

type SessionDatabase = {
  manager: DatabaseManager | null;
  syncController: SyncController | null;
};

const SessionDatabaseContext = createContext<SessionDatabase | null>(null);

/**
 * One database per signed-in account, opened and closed with the
 * session. The lifecycle itself lives in remelonDB's useSessionDatabase;
 * this supplies the native pieces and puts the result on context.
 *
 * It wraps the navigator in app/_layout.tsx, which is what the hook
 * requires: its close queue lives as long as the component calling it,
 * so mounting it inside a screen would lose that queue on every
 * navigation.
 */
export function SessionDatabaseProvider({ children }: { children: ReactNode }) {
  const { data: session, isPending } = authClient.useSession();
  // Null while the session check runs: useSession keeps the previous
  // user visible while it refetches, and that user's database is the
  // wrong one to open. Also null until onboarding completed: the profile
  // row the first pull expects is created by the /onboard transaction.
  const userId =
    isPending || !session?.user.onBoardingComplete
      ? null
      : (session.user.id ?? null);

  const { manager, syncController, closeError } = useOwnedDatabase({
    userId,
    createManager: createUserDatabaseManager,
    sync: { pullChanges, pushChanges },
    controller: { triggers: nativeSyncTriggers },
  });

  if (closeError) {
    return <DatabaseUnrecoverable error={closeError} />;
  }

  // Render the tree either way. The manager arrives from an effect, so
  // an authenticated first paint has none yet; blanking here would
  // unmount the navigator, including the signed-out screens. Consumers
  // reach the manager through useSessionDatabase, which is null-safe.
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
 * Nothing in the app can clear that, which is why this replaces the tree
 * rather than sitting inside it: there is no database to provide, and no
 * screen worth showing without one.
 *
 * Native has no page reload. Restarting is the user's job unless we take
 * on expo-updates for a programmatic one, which is not worth a
 * dependency for a path this rare.
 */
function DatabaseUnrecoverable({ error }: { error: Error }) {
  return (
    <View className="flex-1 items-center justify-center gap-3 bg-background p-6">
      <Text className="text-center text-lg font-semibold text-foreground">
        Restart the app
      </Text>
      <Text className="text-center text-sm text-muted-foreground">
        The offline database could not be closed, so it is not safe to open it
        again in this session.
      </Text>
      <Text className="text-center text-xs text-muted-foreground">
        {error.message}
      </Text>
    </View>
  );
}

export function useSessionDatabase(): SessionDatabase {
  const value = useContext(SessionDatabaseContext);
  if (!value) {
    throw new Error('useSessionDatabase requires SessionDatabaseProvider');
  }
  return value;
}
