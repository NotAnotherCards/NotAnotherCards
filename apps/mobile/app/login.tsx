import { useRouter } from 'expo-router'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { loginSchema, type LoginFormData } from '@repo/schemas'
import { authClient } from '../lib/auth-client'
import { AuthCard } from '../components/auth/auth-card'
import { Button } from '../components/ui/button'
import { FormField } from '../components/ui/form-field'
import { Text } from '../components/ui/text'

export default function Login() {
  const router = useRouter()
  const [apiError, setApiError] = useState<string | null>(null)
  const { control, handleSubmit, formState } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })
  const { isSubmitting } = formState

  const onSubmit = async (data: LoginFormData) => {
    setApiError(null)
    const { error } = await authClient.signIn.email({
      email: data.email,
      password: data.password,
    })
    if (error) {
      setApiError(error.message ?? 'An unexpected error occurred')
      return
    }
    router.replace('/dashboard')
  }

  return (
    <AuthCard
      title="Welcome back"
      description="Log in to your account"
      footerText="Don't have an account?"
      footerLinkText="Sign up"
      footerLinkTo="/register"
    >
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
        <Text className="text-center text-red-600">{apiError}</Text>
      )}

      <Button
        label="Log in"
        loading={isSubmitting}
        onPress={handleSubmit(onSubmit)}
        className="mt-1"
      />
    </AuthCard>
  )
}
