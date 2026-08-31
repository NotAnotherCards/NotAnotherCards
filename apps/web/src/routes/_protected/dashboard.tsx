import { DashboardComponent } from '@/components/dashboard/Dashboard';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_protected/dashboard')({
  component: DashboardComponent,
});
