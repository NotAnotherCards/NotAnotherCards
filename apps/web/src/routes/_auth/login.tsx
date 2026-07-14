import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_auth/login")({
  component: LoginComponent,
});

function LoginComponent() {
  return (
    <div>
      <h1>LOGIN PAGE</h1>
    </div>
  );
}
