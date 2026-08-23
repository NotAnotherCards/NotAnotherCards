import { createFileRoute, redirect } from "@tanstack/react-router";
import { HomeComponent } from "@/components/Home";
import { authClient } from "@/lib/auth-client";
import { checkOnboardingComplete } from "@/offline/db";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const { data: session } = await authClient.getSession();
    if (session) {
      const onboardingComplete = await checkOnboardingComplete(session.user.id);
      if (onboardingComplete) {
        throw redirect({
          to: "/app/dashboard",
        });
      }
    }
  },
  component: HomeComponent,
});