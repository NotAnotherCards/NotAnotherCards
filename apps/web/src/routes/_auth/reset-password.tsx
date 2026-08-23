import { ResetPasswordComponent } from '@/components/auth/reset-password-form'
import { createFileRoute } from '@tanstack/react-router'

type ResetPasswordSearch = {
  token?: string
}

export const Route = createFileRoute('/_auth/reset-password')({
  validateSearch: (search: Record<string, unknown>): ResetPasswordSearch => {
    return {
      token: typeof search.token === 'string' ? search.token : undefined,
    }
  },
  component: ResetPasswordComponent,
})
