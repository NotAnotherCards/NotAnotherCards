import { createFileRoute } from "@tanstack/react-router";
import { RegisterComponent } from "@/components/auth/register-form";

export const Route = createFileRoute("/_auth/register")({
  component: RegisterComponent,
});
