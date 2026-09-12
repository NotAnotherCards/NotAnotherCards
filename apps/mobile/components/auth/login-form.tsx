import { useState } from 'react';
import { Link } from 'expo-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginFormData } from '@repo/schemas';
import { authClient } from '@/lib/auth-client';
import { apiErrorMessage } from '@/lib/errors';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Text } from '@/components/ui/text';
import { SocialLoginButtons } from '@/components/auth/social-login-buttons';

export function LoginForm() {
  const [apiError, setApiError] = useState<string | null>(null);
  const { control, handleSubmit, formState } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });
  const { isSubmitting } = formState;

  const onSubmit = async (data: LoginFormData) => {
    setApiError(null);
    try {
      const { error } = await authClient.signIn.email({
        email: data.email,
        password: data.password,
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
        placeholder="Your password"
        secureTextEntry
        autoCapitalize="none"
      />

      {apiError && (
        <Text className="text-center text-destructive">{apiError}</Text>
      )}

      <Button
        loading={isSubmitting}
        onPress={handleSubmit(onSubmit)}
        className="mt-1"
      >
        <Text>Log in</Text>
      </Button>

      <SocialLoginButtons />

      <Text className="mt-1 text-center text-muted-foreground">
        Forgot your password?{' '}
        <Link href="/forgot-password" asChild>
          <Text className="font-semibold text-foreground">Reset here!</Text>
        </Link>
      </Text>
    </>
  );
}
