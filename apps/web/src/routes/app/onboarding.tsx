import { OnBoardingComponent } from '@/components/OnBoarding'
import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/app/onboarding')({
  beforeLoad: () => {
    const nativeLanguage = localStorage.getItem("nativeLanguage");
    const preferedLanguage = localStorage.getItem("preferedLanguage");
    if (nativeLanguage && preferedLanguage) {
      throw redirect({
        to: "/app/dashboard",
      });
    }
  },
  component: OnBoardingComponent,
})
