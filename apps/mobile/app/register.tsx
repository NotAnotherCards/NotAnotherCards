import { useIsFocused, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { authClient } from '@/lib/auth-client';
import { AuthCard } from '@/components/auth/auth-card';
import { SignupForm } from '@/components/auth/signup-form';

export default function Register() {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const isFocused = useIsFocused();

  // Navigate from session state, not from the signUp response: the session
  // store updates a moment after the request resolves, and the dashboard
  // bounces to /login if it mounts before then. Only while this screen is
  // the one showing, as in app/login.tsx.
  useEffect(() => {
    if (isFocused && session)
      router.replace(
        session.user.onBoardingComplete ? '/dashboard' : '/onboarding',
      );
  }, [isFocused, session, router]);

  return (
    <AuthCard
      title="Create Account"
      description="Enter your details to create a new profile"
      footerText="Already have an account?"
      footerLinkText="Log in"
      footerLinkTo="/login"
    >
      <SignupForm />
    </AuthCard>
  );
}
