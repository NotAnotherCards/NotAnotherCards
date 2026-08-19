import { Outlet, createRootRoute } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { ThemeProvider } from "next-themes";

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return (
    <ThemeProvider attribute="class">
      <main>
        <Outlet />
      </main>
      <TanStackRouterDevtools />
    </ThemeProvider>
  );
}

