import { useRouter } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { registerSchema, type SignupFormData } from '@repo/schemas'
import { authClient } from '../lib/auth-client'
import { AuthCard } from '../components/auth/auth-card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Text } from '../components/ui/text'

export default function Register() {
  const router = useRouter()
  const [apiError, setApiError] = useState<string | null>(null)
  const { control, handleSubmit, formState } = useForm<SignupFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
  })
  const { isSubmitting } = formState

  const onSubmit = async (data: SignupFormData) => {
    setApiError(null)
    const { error } = await authClient.signUp.email({
      name: data.name,
      email: data.email,
      password: data.password,
    })
    if (error) {
      setApiError(error.message ?? 'An unexpected error occurred')
      return
    }
    router.replace('/dashboard')
  }

  const fields = [
    {
      name: 'name' as const,
      label: 'Name',
      placeholder: 'Jane Doe',
      props: { autoCapitalize: 'words' as const },
    },
    {
      name: 'email' as const,
      label: 'Email',
      placeholder: 'you@example.com',
      props: {
        autoCapitalize: 'none' as const,
        autoComplete: 'email' as const,
        keyboardType: 'email-address' as const,
      },
    },
    {
      name: 'password' as const,
      label: 'Password',
      placeholder: 'Create a password',
      props: { secureTextEntry: true, autoCapitalize: 'none' as const },
    },
    {
      name: 'confirmPassword' as const,
      label: 'Confirm password',
      placeholder: 'Repeat your password',
      props: { secureTextEntry: true, autoCapitalize: 'none' as const },
    },
  ]

  return (
    <AuthCard
      title="Create account"
      description="Sign up to get started"
      footerText="Already have an account?"
      footerLinkText="Log in"
      footerLinkTo="/login"
    >
      {fields.map((f) => (
        <Controller
          key={f.name}
          control={control}
          name={f.name}
          render={({ field: { onChange, onBlur, value }, fieldState }) => (
            <View className="gap-1">
              <Label>{f.label}</Label>
              <Input
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                invalid={fieldState.invalid}
                placeholder={f.placeholder}
                {...f.props}
              />
              {fieldState.error && (
                <Text className="text-sm text-red-600">
                  {fieldState.error.message}
                </Text>
              )}
            </View>
          )}
        />
      ))}

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
