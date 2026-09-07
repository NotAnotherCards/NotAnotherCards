import { useState } from 'react';
import { View } from 'react-native';
import { authClient } from '@/lib/auth-client';
import { apiErrorMessage } from '@/lib/errors';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { GoogleIcon } from '@/components/ui/google-icon';
import { FacebookIcon } from '@/components/ui/facebook-icon';

export type SocialProvider = 'google' | 'facebook';

const LABELS: Record<SocialProvider, string> = {
  google: 'Continue with Google',
  facebook: 'Continue with Facebook',
};

// The Expo auth client does the browser round trip: it opens the provider
// in the system browser, and when the API redirects back to the app's
// scheme it stores the session. A relative callbackURL becomes that scheme
// URL. The screen's session effect then navigates, as it does for email.
export function SocialLoginButtons() {
  const [busy, setBusy] = useState<SocialProvider | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const signIn = async (provider: SocialProvider) => {
    setApiError(null);
    setBusy(provider);
    try {
      const { error } = await authClient.signIn.social({
        provider,
        callbackURL: '/dashboard',
        errorCallbackURL: '/login',
      });
      if (error) setApiError(apiErrorMessage(error));
    } catch (err) {
      setApiError(apiErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <View className="gap-2">
      <View className="my-1 flex-row items-center gap-3">
        <View className="h-px flex-1 bg-border" />
        <Text className="text-xs text-muted-foreground">or continue with</Text>
        <View className="h-px flex-1 bg-border" />
      </View>
      {(['google', 'facebook'] as const).map((provider) => (
        <Button
          key={provider}
          variant="outline"
          loading={busy === provider}
          disabled={busy !== null}
          onPress={() => void signIn(provider)}
          accessibilityLabel={LABELS[provider]}
        >
          <View className="flex-row items-center gap-2">
            {busy !== provider &&
              (provider === 'google' ? <GoogleIcon /> : <FacebookIcon />)}
            <Text>{LABELS[provider]}</Text>
          </View>
        </Button>
      ))}
      {apiError && (
        <Text className="text-center text-destructive">{apiError}</Text>
      )}
    </View>
  );
}
