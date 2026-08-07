import { createFileRoute, redirect } from "@tanstack/react-router";
import { HomeComponent } from "@/components/Home";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const { data: session } = await authClient.getSession()
    if (session) {
      const nativeLanguage = localStorage.getItem("nativeLanguage");
      const preferedLanguage = localStorage.getItem("preferedLanguage");
      if (nativeLanguage && preferedLanguage) {
        throw redirect({
          to: "/app/dashboard"
        })
      } else {
        throw redirect({
          to: "/app/onboarding"
        })
      }
    }
  },
  component: HomeComponent,
});