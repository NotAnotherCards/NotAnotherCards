import { useIsFocused, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { authClient } from '@/lib/auth-client';
import { AuthCard } from '@/components/auth/auth-card';
import { LoginForm } from '@/components/auth/login-form';
import {
  useTwoFactorChallengeState,
  useTwoFactorDeepLinkPending,
} from '@/lib/two-factor-challenge';

export default function Login() {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const challenge = useTwoFactorChallengeState();
  const deepLinkPending = useTwoFactorDeepLinkPending();
  const isFocused = useIsFocused();

  // Navigate from session state, not from the signIn response: the session
  // store updates a moment after the request resolves, and the dashboard
  // bounces to /login if it mounts before then. Only while this screen is
  // the one showing: left under the dashboard (Log in → Sign up → the
  // dashboard), it would otherwise replace the live screen with a fresh
  // dashboard on every later session change, such as enabling 2FA.
  useEffect(() => {
    if (!isFocused || !challenge.hydrated) return;
    if (deepLinkPending || challenge.pending) {
      router.replace('/two-factor');
    } else if (session) {
      router.replace(
        session.user.onBoardingComplete ? '/dashboard' : '/onboarding',
      );
    }
  }, [challenge, deepLinkPending, isFocused, session, router]);

  return (
    <AuthCard
      title="Welcome Back"
      description="Enter your email below to log in to your account"
      footerText="Don't have an account?"
      footerLinkText="Sign up"
      footerLinkTo="/register"
    >
      <LoginForm />
    </AuthCard>
  );
}
