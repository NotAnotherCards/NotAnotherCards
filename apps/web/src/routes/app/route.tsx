import { authClient } from "@/lib/auth-client";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { DatabaseBanner } from "@/components/DatabaseBanner";
import { createUserDatabaseManager, closeUserDatabase } from "@/offline/db";

import { DatabaseProvider } from "@remelondb/core/react";

export const Route = createFileRoute("/app")({
  beforeLoad: async () => {
    const { data: session } = await authClient.getSession();
    if (!session) {
      throw redirect({
        to: "/login",
      });
    }
  },
  component: AppLayout,
});

function AppLayout() {
  const { data: session } = authClient.useSession();
  const userId = session?.user?.id;

  const [userManager, setUserManager] = useState<ReturnType<typeof createUserDatabaseManager> | null>(null);

  useEffect(() => {
    if (!userId) {
      setUserManager(null);
      return;
    }
    const manager = createUserDatabaseManager(userId);
    setUserManager(manager);
    manager.init().catch((err) => {
      console.error("Database initialization failed", err);
    });
    return () => {
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
      <div className="flex-1 flex flex-col bg-background">
        <DatabaseBanner />
        <div className="flex-1 flex flex-col">
          <Outlet />
        </div>
      </div>
    </DatabaseProvider>
  );
}
