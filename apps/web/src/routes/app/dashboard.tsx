import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/app/dashboard")({
  component: DashboardComponent,
});

function DashboardComponent() {
  const { data: session } = authClient.useSession();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await authClient.signOut();
    navigate({ to: "/login" });
  };

  return (
    <div>
      <h1>DASHBOARD PAGE</h1>
      {session?.user && (
        <div>
          <p>
            Welcome, <strong>{session.user.name}</strong>!
          </p>
          <p>Logged in as: {session.user.email}</p>
          <Button onClick={handleLogout}>Logout</Button>
        </div>
      )}
    </div>
  );
}
