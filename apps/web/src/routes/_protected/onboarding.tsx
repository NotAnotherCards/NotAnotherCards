import { OnBoardingComponent } from '@/components/OnBoarding';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_protected/onboarding')({
  component: OnBoardingComponent,
});

