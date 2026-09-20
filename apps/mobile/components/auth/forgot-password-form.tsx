import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'expo-router';
import { authClient } from '@/lib/auth-client';
import { apiErrorMessage } from '@/lib/errors';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Text } from '@/components/ui/text';

const forgotPasswordSchema = z.object({
  email: z.email('Please enter a valid email address'),
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

export function ForgotPasswordForm({
  defaultEmail = '',
}: {
  defaultEmail?: string;
}) {
  const router = useRouter();
  const [apiError, setApiError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const { control, handleSubmit, formState } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: defaultEmail },
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setApiError(null);
    try {
      // The API's email callback opens the existing web reset-password page;
      // the request itself is fully supported by the Expo auth client.
      const { error } = await authClient.requestPasswordReset({
        email: data.email,
      });
      if (error) {
        setApiError(apiErrorMessage(error));
        return;
      }
      setSentTo(data.email);
    } catch (error) {
      setApiError(apiErrorMessage(error));
    }
  };

  if (sentTo) {
    return (
      <>
        <Text className="text-center text-muted-foreground">
          Check {sentTo} for a password reset link. After creating a password,
          return here to sign in and enable two-factor authentication.
        </Text>
        <Button onPress={() => router.replace('/login')}>
          <Text>Back to sign in</Text>
        </Button>
      </>
    );
  }

  return (
    <>
      <FormField
        control={control}
        name="email"
        label="Email"
        placeholder="you@example.com"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
      />
      {apiError ? (
        <Text
          accessibilityRole="alert"
          className="text-center text-destructive"
        >
          {apiError}
        </Text>
      ) : null}
      <Button loading={formState.isSubmitting} onPress={handleSubmit(onSubmit)}>
        <Text>Send reset link</Text>
      </Button>
    </>
  );
}
