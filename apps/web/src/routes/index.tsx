import { createFileRoute, redirect } from "@tanstack/react-router";
import { HomeComponent } from "@/components/Home";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const { data: session } = await authClient.getSession()
    if (session) {
      // TODO: When backend is ready, check if user has onboarding settings.
      // If they do, redirect to "/app/dashboard". If not, they can either stay or redirect to onboarding.
      throw redirect({
        to: "/app/dashboard"
      })
    }
  },
  component: HomeComponent,
});