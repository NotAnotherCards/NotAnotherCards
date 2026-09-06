import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { authClient } from '@/lib/auth-client';
import { AuthCard } from '@/components/auth/auth-card';
import { SignupForm } from '@/components/auth/signup-form';

export default function Register() {
  const router = useRouter();
  const { data: session } = authClient.useSession();

  // Navigate from session state, not from the signUp response: the session
  // store updates a moment after the request resolves, and the dashboard
  // bounces to /login if it mounts before then.
  useEffect(() => {
    if (session)
      router.replace(
        session.user.onBoardingComplete ? '/dashboard' : '/onboarding',
      );
  }, [session, router]);

  return (
    <AuthCard
      title="Create account"
      description="Sign up to get started"
      footerText="Already have an account?"
      footerLinkText="Log in"
      footerLinkTo="/login"
    >
      <SignupForm />
    </AuthCard>
  );
}
