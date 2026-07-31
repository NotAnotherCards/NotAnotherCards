import { DashboardComponent } from "@/components/dashboard/Dashboard";
import { createFileRoute } from "@tanstack/react-router";


export const Route = createFileRoute("/app/dashboard")({
  component: DashboardComponent,
});