import { createFileRoute } from '@tanstack/react-router';
import { TwoFactorChallenge } from '@/components/auth/two-factor-challenge';
import { safeReturnTo } from '@/lib/two-factor-challenge';

type TwoFactorSearch = {
  redirect?: string;
};

export const Route = createFileRoute('/_auth/two-factor')({
  validateSearch: (search: Record<string, unknown>): TwoFactorSearch => ({
    redirect:
      typeof search.redirect === 'string'
        ? safeReturnTo(search.redirect)
        : undefined,
  }),
  component: TwoFactorRoute,
});

function TwoFactorRoute() {
  const { redirect } = Route.useSearch();
  return <TwoFactorChallenge redirect={redirect} />;
}
