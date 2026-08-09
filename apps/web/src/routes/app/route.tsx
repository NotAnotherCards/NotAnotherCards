import { authClient } from "@/lib/auth-client";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/app")({
  beforeLoad: async ({ location }) => {
    const { data: session } = await authClient.getSession();
    if (!session) {
      if (location.pathname === "/app/onboarding" || location.pathname === "/app") {
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
  return (
    <div className="flex-1 flex flex-col bg-background">
      <div className="flex-1 flex flex-col">
        <Outlet />
      </div>
    </div>
  );
}
