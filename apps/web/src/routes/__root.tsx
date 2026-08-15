import { Outlet, createRootRoute } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { ThemeProvider } from "next-themes";
import { ThemeChanger } from "@/components/ThemeChanger";

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return (
    <ThemeProvider attribute="class">
      <main>
        <ThemeChanger />
        <Outlet />
      </main>
      <TanStackRouterDevtools />
    </ThemeProvider>
  );
}
