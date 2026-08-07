import { authClient } from "@/lib/auth-client";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_auth")({
  beforeLoad: async () => {
    const { data: session } = await authClient.getSession();
    if (session) {
      const nativeLanguage = localStorage.getItem("nativeLanguage");
      const preferedLanguage = localStorage.getItem("preferedLanguage");
      const hasSettings = !!(nativeLanguage && preferedLanguage);

      if (hasSettings) {
        throw redirect({
          to: "/app/dashboard",
        });
      } else {
        await authClient.signOut();
      }
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
