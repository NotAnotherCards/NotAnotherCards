import { Outlet, createRootRoute } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { useEffect } from "react";
import { manager } from "@/offline/db";
import { DatabaseBanner } from "@/components/DatabaseBanner";

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  useEffect(() => {
    manager.init().catch(() => {});
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
