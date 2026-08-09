import { Outlet, createRootRoute } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { useEffect } from "react";
import { manager } from "@/offline/db";
import { DatabaseBanner } from "@/components/DatabaseBanner";
import { ThemeProvider } from "next-themes";

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  useEffect(() => {
    if (manager.state.status === "idle" || manager.state.status === "error") {
      manager.init().catch(() => {});
    }
  }, []);

  return (
    <ThemeProvider attribute="class">
      <DatabaseBanner />
      <main className="relative min-h-screen">
        <Outlet />
      </main>
      <TanStackRouterDevtools />
    </ThemeProvider>
  );
}

