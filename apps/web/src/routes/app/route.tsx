import { authClient } from "@/lib/auth-client";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/app")({
  beforeLoad: async ({ location }) => {
    const { data: session } = await authClient.getSession();
    if (!session) {
      if (location.pathname === "/app/onboarding") {
        throw redirect({
          to: "/",
        });
      }
      throw redirect({
        to: "/login",
      });
    }

    const nativeLanguage = localStorage.getItem("nativeLanguage");
    const preferedLanguage = localStorage.getItem("preferedLanguage");
    const hasSettings = !!(nativeLanguage && preferedLanguage);

    if (!hasSettings && location.pathname !== "/app/onboarding") {
      throw redirect({
        to: "/app/onboarding",
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
