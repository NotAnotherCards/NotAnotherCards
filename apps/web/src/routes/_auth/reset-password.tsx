import { ResetPasswordComponent } from '@/components/auth/reset-password-form'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_auth/reset-password')({
  component: ResetPasswordComponent,
})
