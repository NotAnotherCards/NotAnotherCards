import { OnBoardingComponent } from '@/components/OnBoarding'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/app/onboarding')({
  component: OnBoardingComponent,
})
