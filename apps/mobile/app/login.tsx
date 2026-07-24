import { useRouter } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { loginSchema, type LoginFormData } from '@repo/schemas'
import { authClient } from '../lib/auth-client'
import { AuthCard } from '../components/auth/auth-card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
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
      <Controller
        control={control}
        name="email"
        render={({ field: { onChange, onBlur, value }, fieldState }) => (
          <View className="gap-1">
            <Label>Email</Label>
            <Input
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              invalid={fieldState.invalid}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              placeholder="you@example.com"
            />
            {fieldState.error && (
              <Text className="text-sm text-red-600">
                {fieldState.error.message}
              </Text>
            )}
          </View>
        )}
      />

      <Controller
        control={control}
        name="password"
        render={({ field: { onChange, onBlur, value }, fieldState }) => (
          <View className="gap-1">
            <Label>Password</Label>
            <Input
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              invalid={fieldState.invalid}
              secureTextEntry
              autoCapitalize="none"
              placeholder="Your password"
            />
            {fieldState.error && (
              <Text className="text-sm text-red-600">
                {fieldState.error.message}
              </Text>
            )}
          </View>
        )}
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
