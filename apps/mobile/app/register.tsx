import { useRouter } from 'expo-router'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { registerSchema, type SignupFormData } from '@repo/schemas'
import { authClient } from '../lib/auth-client'
import { AuthCard } from '../components/auth/auth-card'
import { Button } from '../components/ui/button'
import { FormField } from '../components/ui/form-field'
import { Text } from '../components/ui/text'

export default function Register() {
  const router = useRouter()
  const [apiError, setApiError] = useState<string | null>(null)
  const { control, handleSubmit, formState } = useForm<SignupFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  })
  const { isSubmitting } = formState

  const onSubmit = async (data: SignupFormData) => {
    setApiError(null)
    const { error } = await authClient.signUp.email({
      name: data.name,
      username: data.username,
      email: data.email,
      password: data.password,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    })
    if (error) {
      setApiError(error.message ?? 'An unexpected error occurred')
      return
    }
    router.replace('/dashboard')
  }

  return (
    <AuthCard
      title="Create account"
      description="Sign up to get started"
      footerText="Already have an account?"
      footerLinkText="Log in"
      footerLinkTo="/login"
    >
      <FormField
        control={control}
        name="name"
        label="Name"
        placeholder="Jane Doe"
        autoCapitalize="words"
      />
      <FormField
        control={control}
        name="username"
        label="Username"
        placeholder="jane_doe"
        autoCapitalize="none"
        autoComplete="username"
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
        <Text className="text-center text-red-600">{apiError}</Text>
      )}

      <Button
        label="Create account"
        loading={isSubmitting}
        onPress={handleSubmit(onSubmit)}
        className="mt-1"
      />
    </AuthCard>
  )
}
