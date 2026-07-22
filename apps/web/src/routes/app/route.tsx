// import { authClient } from "@/lib/auth-client";
// import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/app")({
  // beforeLoad: async () => {
  //   const { data: session } = await authClient.getSession();
  //   if (!session) {
  //     throw redirect({
  //       to: '/login'
  //     })
  //   }
  // },
  component: AppLayout,
});

function AppLayout() {
  return (
    <div>
      <p>Everything here will be protected</p>
      <Outlet />
    </div>
  );
}
