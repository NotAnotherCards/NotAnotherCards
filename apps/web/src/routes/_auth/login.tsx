import { createFileRoute } from "@tanstack/react-router";
import { LoginComponent } from "@/components/auth/login-form";

export const Route = createFileRoute("/_auth/login")({
  component: LoginComponent,
});
