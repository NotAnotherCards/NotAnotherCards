import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema, type SignupFormData } from '@repo/schemas';
import { authClient } from '@/lib/auth-client';
import { apiErrorMessage } from '@/lib/errors';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Text } from '@/components/ui/text';

// Hermes' Intl support is partial; if timezone detection fails the field
// stays unset and the server defaults to UTC.
function getTimezone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

export function SignupForm() {
  const [apiError, setApiError] = useState<string | null>(null);
  const { control, handleSubmit, formState } = useForm<SignupFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });
  const { isSubmitting } = formState;

  const onSubmit = async (data: SignupFormData) => {
    setApiError(null);
    try {
      const { error } = await authClient.signUp.email({
        name: data.name,
        email: data.email,
        password: data.password,
        timezone: getTimezone(),
      });
      if (error) {
        setApiError(apiErrorMessage(error));
      }
    } catch (err) {
      setApiError(apiErrorMessage(err));
    }
  };

  return (
    <>
      <FormField
        control={control}
        name="name"
        label="Name"
        placeholder="Jane Doe"
        autoCapitalize="words"
      />
      <FormField
        control={control}
        name="email"
        label="Email"
        placeholder="you@example.com"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
      />
      <FormField
        control={control}
        name="password"
        label="Password"
        placeholder="Create a password"
        secureTextEntry
        autoCapitalize="none"
      />
      <FormField
        control={control}
        name="confirmPassword"
        label="Confirm password"
        placeholder="Repeat your password"
        secureTextEntry
        autoCapitalize="none"
      />

      {apiError && (
        <Text className="text-center text-destructive">{apiError}</Text>
      )}

      <Button
        label="Create account"
        loading={isSubmitting}
        onPress={handleSubmit(onSubmit)}
        className="mt-1"
      />
    </>
  );
}
