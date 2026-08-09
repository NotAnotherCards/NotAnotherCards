import { Outlet, createRootRoute } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { useEffect } from "react";
import { manager } from "@/offline/db";
import { DatabaseBanner } from "@/components/DatabaseBanner";
import { ThemeProvider } from "next-themes";
import { ThemeChanger } from "@/components/ThemeChanger";

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
      <main>
        <ThemeChanger />
        <Outlet />
      </main>
      <TanStackRouterDevtools />
    </ThemeProvider>
  );
}

