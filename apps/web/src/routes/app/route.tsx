import { authClient } from "@/lib/auth-client";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { DatabaseBanner } from "@/components/DatabaseBanner";
import { createUserDatabaseManager, closeUserDatabase } from "@/offline/db";
import { createRunSync } from "@/offline/sync";
import { createSyncController, type SyncController } from "@/offline/syncController";
import { SyncProvider } from "@/offline/syncProvider";
import { SyncStatus } from "@/components/SyncStatus";

import { DatabaseProvider } from "@remelondb/core/react";

export const Route = createFileRoute("/app")({
  beforeLoad: async ({ location }) => {
    const { data: session } = await authClient.getSession();
    if (!session) {
      if (
        location.pathname === "/app/onboarding" ||
        location.pathname === "/app"
      ) {
        throw redirect({
          to: "/",
        });
      }
      throw redirect({
        to: "/login",
      });
    }

    // TODO: When backend is ready, check if user settings exist (e.g. native and preferred languages).
    // If settings are missing and they are not already on "/app/onboarding", redirect to "/app/onboarding".
    if (location.pathname === "/app") {
      throw redirect({
        to: "/app/dashboard",
      });
    }
  },
  component: AppLayout,
});

function AppLayout() {
  const { data: session } = authClient.useSession();
  const userId = session?.user?.id;

  const [userManager, setUserManager] = useState<ReturnType<typeof createUserDatabaseManager> | null>(null);
  const [syncController, setSyncController] = useState<SyncController | null>(null);

  useEffect(() => {
    if (!userId) {
      setUserManager(null);
      setSyncController(null);
      return;
    }
    const manager = createUserDatabaseManager(userId);
    setUserManager(manager);
    let controller: SyncController | null = null;
    let cancelled = false;
    void (async () => {
      try {
        const database = await manager.init();
        if (cancelled || !database) return;
        // sync starts only once the user's database is open; it dies
        // with the session below
        controller = createSyncController({ runSync: createRunSync(database) });
        setSyncController(controller);
        controller.start();
      } catch (err) {
        console.error("Database initialization failed", err);
      }
    })();
    return () => {
      cancelled = true;
      controller?.dispose();
      setSyncController(null);
      void closeUserDatabase().catch((err) => {
        console.error("Database close failed", err);
      });
      setUserManager(null);
    };
  }, [userId]);

  if (!userManager) {
    return null;
  }

  return (
    <DatabaseProvider manager={userManager}>
      <SyncProvider controller={syncController}>
      <div className="flex-1 flex flex-col bg-background">
        <DatabaseBanner />
        <SyncStatus />
        <div className="flex-1 flex flex-col">
          <Outlet />
        </div>
      </div>
      </SyncProvider>
    </DatabaseProvider>
  );
}
