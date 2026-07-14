import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/app")({
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
