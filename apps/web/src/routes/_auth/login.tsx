import { createFileRoute } from '@tanstack/react-router';
import { LoginComponent } from '@/components/auth/login-form';

type LoginSearch = {
  redirect?: string;
};

export const Route = createFileRoute('/_auth/login')({
  validateSearch: (search: Record<string, unknown>): LoginSearch => ({
    redirect: typeof search.redirect === 'string' ? search.redirect : undefined,
  }),
  component: LoginComponent,
});
