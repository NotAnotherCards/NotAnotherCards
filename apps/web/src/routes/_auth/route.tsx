import { authClient } from "@/lib/auth-client";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_auth")({
  beforeLoad: async () => {
    const { data: session } = await authClient.getSession();
    if (session) {
      // TODO: When backend is ready, check if the user has set up their onboarding settings.
      // If not, redirect them to "/app/onboarding" instead of going directly to dashboard.
      throw redirect({
        to: "/app/dashboard",
      });
    }
  },
  component: AuthLayout,
});

function AuthLayout() {
  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <Outlet />
    </div>
  );
}
