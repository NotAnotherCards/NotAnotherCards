import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_auth/register")({
  component: RegisterComponent,
});

function RegisterComponent() {
  return (
    <div>
      <h1>REGISTRATION PAGE</h1>
    </div>
  );
}
