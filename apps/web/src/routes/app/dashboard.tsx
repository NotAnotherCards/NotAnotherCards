import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/app/dashboard")({
  component: DashboardComponent,
});

function DashboardComponent() {
  return (
    <div>
      <h3>DASHBOARD PAGE</h3>
    </div>
  );
}
