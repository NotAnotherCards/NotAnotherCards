import { Outlet, createRootRoute } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { useEffect } from "react";
import { dbManager } from "@/offline/db";
import { DatabaseBanner } from "@/components/DatabaseBanner";

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  useEffect(() => {
    dbManager.init().catch(() => {});
  }, []);

  return (
    <>
      <DatabaseBanner />
      <main>
        <Outlet />
      </main>
      <TanStackRouterDevtools />
    </>
  );
}
