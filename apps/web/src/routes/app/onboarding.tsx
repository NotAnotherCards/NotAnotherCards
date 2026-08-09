import { OnBoardingComponent } from '@/components/OnBoarding'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/app/onboarding')({
  beforeLoad: () => {
    // TODO: When backend is ready, check if user already completed onboarding settings.
    // If settings exist, redirect them to "/app/dashboard".
  },
  component: OnBoardingComponent,
})
