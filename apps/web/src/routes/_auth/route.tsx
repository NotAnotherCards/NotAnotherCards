// import { authClient } from "@/lib/auth-client";
// import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_auth")({
  // beforeLoad: async () => {
  //   const { data: session } = await authClient.getSession()
  //   if (session) {
  //     throw redirect({
  //       to: '/app/dashboard'
  //     })
  //   }
  // },
  component: AuthLayout,
});

function AuthLayout() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <Outlet />
    </div>
  );
}
