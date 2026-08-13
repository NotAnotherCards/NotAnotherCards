import { ForgotPasswordComponent } from '@/components/auth/forgot-password-form'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_auth/forgot-password')({
  component: ForgotPasswordComponent,
})
