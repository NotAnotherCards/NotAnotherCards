import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { authClient } from '@/lib/auth-client';
import { useSignOutBarrier } from '@/lib/sync-sign-out';
import { toUiError, UiError, uiErrorText } from '@/lib/errors';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { GoogleIcon } from '@/components/ui/google-icon';
import {
  beginTwoFactorChallenge,
  hasTwoFactorChallengeCookie,
  isTwoFactorRedirect,
} from '@/lib/two-factor-challenge';

export type SocialProvider = 'google';

// Labelled like the web's buttons: the provider name alone.
const LABELS: Record<SocialProvider, string> = {
  google: 'Google',
};

// The Expo auth client does the browser round trip: it opens the provider
// in the system browser, and when the API redirects back to the app's
// scheme it stores the session. A relative callbackURL becomes that scheme
// URL. The screen's session effect then navigates, as it does for email.
export function SocialLoginButtons() {
  const { t } = useTranslation();
  const { signingOut, waitForSignOut } = useSignOutBarrier();
  const router = useRouter();
  const [busy, setBusy] = useState<SocialProvider | null>(null);
  const [apiError, setApiError] = useState<UiError | null>(null);

  const signIn = async (provider: SocialProvider) => {
    setApiError(null);
    setBusy(provider);
    try {
      if (!(await waitForSignOut())) return;
      const { data, error } = await authClient.signIn.social({
        provider,
        callbackURL: '/dashboard',
        errorCallbackURL: '/login',
      });
      if (error) {
        setApiError(toUiError(error));
      } else if (
        isTwoFactorRedirect(data) ||
        hasTwoFactorChallengeCookie(authClient.getCookie())
      ) {
        // iOS returns the browser callback to ASWebAuthenticationSession, not
        // Expo Router. The adapter has saved its cookies before this resolves,
        // even though the response still describes the initial OAuth redirect.
        await beginTwoFactorChallenge();
        router.replace('/two-factor');
      }
    } catch (err) {
      setApiError(toUiError(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <View className="gap-2">
      <View className="my-1 flex-row items-center gap-3">
        <View className="h-px flex-1 bg-border" />
        <Text className="text-xs text-muted-foreground">
          {t('auth.login.continue_with')}
        </Text>
        <View className="h-px flex-1 bg-border" />
      </View>
      {(['google'] as const).map((provider) => (
        <Button
          key={provider}
          variant="outline"
          loading={busy === provider}
          disabled={busy !== null}
          onPress={() => void signIn(provider)}
          accessibilityLabel={t('mobile.messages.continue_provider', {
            provider: LABELS[provider],
          })}
        >
          <View className="flex-row items-center gap-2">
            {busy !== provider && <GoogleIcon />}
            <Text>{signingOut ? t('auth.signing_out') : LABELS[provider]}</Text>
          </View>
        </Button>
      ))}
      {apiError && (
        <Text className="text-center text-destructive">
          {uiErrorText(apiError, t)}
        </Text>
      )}
    </View>
  );
}
