import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { authClient } from '@/lib/auth-client';
import { apiErrorMessage } from '@/lib/errors';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Text } from '@/components/ui/text';

const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});
type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

// The email links to the web's reset page, where the token is consumed; the
// reset itself does not happen in the app. The API builds that link from
// its FRONTEND_URL, so there is no redirect target to pass from here.
export function ForgotPasswordForm({ onSent }: { onSent: () => void }) {
  const [apiError, setApiError] = useState<string | null>(null);
  const { control, handleSubmit, formState } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setApiError(null);
    try {
      const { error } = await authClient.requestPasswordReset({
        email: data.email,
      });
      if (error) setApiError(apiErrorMessage(error));
      else onSent();
    } catch (err) {
      setApiError(apiErrorMessage(err));
    }
  };

  return (
    <>
      <FormField
        control={control}
        name="email"
        label="Email"
        placeholder="name@example.com"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
      />
      {apiError && (
        <Text className="text-center text-destructive">{apiError}</Text>
      )}
      <Button
        loading={formState.isSubmitting}
        onPress={handleSubmit(onSubmit)}
        className="mt-1"
      >
        <Text>Send reset email</Text>
      </Button>
    </>
  );
}
