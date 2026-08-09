import { authClient } from "@/lib/auth-client";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { DatabaseBanner } from "@/components/DatabaseBanner";
import { createUserDatabaseManager, closeUserDatabase } from "@/offline/db";

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

  const userManager = useMemo(() => {
    if (!userId) return null;
    return createUserDatabaseManager(userId);
  }, [userId]);

  useEffect(() => {
    if (userManager) {
      userManager.init().catch((err) => {
        console.error("Database initialization failed", err);
      });
    }
    return () => {
      closeUserDatabase();
    };
  }, [userManager]);

  if (!userManager) {
    return null;
  }

  return (
    <div className="flex-1 flex flex-col bg-background">
      <DatabaseBanner />
      <div className="flex-1 flex flex-col">
        <Outlet />
      </div>
    </div>
  );
}
