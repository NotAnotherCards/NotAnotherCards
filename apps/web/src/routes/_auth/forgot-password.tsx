import { ForgotPasswordComponent } from '@/components/auth/forgot-password-form';
import { createFileRoute } from '@tanstack/react-router';

type ForgotPasswordSearch = {
  email?: string;
};

export const Route = createFileRoute('/_auth/forgot-password')({
  validateSearch: (search: Record<string, unknown>): ForgotPasswordSearch => ({
    email: typeof search.email === 'string' ? search.email : undefined,
  }),
  component: ForgotPasswordComponent,
});
