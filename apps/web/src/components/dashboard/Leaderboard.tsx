import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLeaderboard } from '@/hooks/useLeaderboard';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Trophy, RefreshCcw, Info } from 'lucide-react';
import { LeaderboardEntry } from '@repo/schemas';

const PAGE_SIZE = 20;

export function Leaderboard() {
  const { t } = useTranslation();
  const [page, setPage] = useState(0);
  const { data, hasMore, isLoading, error, lastUpdated, refetch } =
    useLeaderboard(PAGE_SIZE, page * PAGE_SIZE);

  const currentUserInEntries = useMemo(() => {
    return data?.entries.some((entry) => entry.isCurrentUser) ?? false;
  }, [data]);

  const showFloatingCurrentUser = data?.currentUser && !currentUserInEntries;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-heading text-xl font-bold flex items-center gap-2">
            <Trophy className="size-6 text-yellow-500" />
            {t('dashboard.leaderboard.title')}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t('dashboard.leaderboard.description')}
          </p>
        </div>
      </div>

      <Card className="bg-muted/30 border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Info className="size-4" />
            {t('dashboard.leaderboard.how_it_works')}
          </CardTitle>
          <CardDescription>
            {t('dashboard.leaderboard.how_it_works_description')}
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle>{t('dashboard.leaderboard.top_learners')}</CardTitle>
          {lastUpdated && (
            <div className="text-xs text-muted-foreground flex items-center gap-2">
              {t('dashboard.leaderboard.snapshot')}
              {new Date(lastUpdated).toLocaleTimeString()}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => refetch()}
                className="h-6 px-2"
              >
                <RefreshCcw className="size-3 mr-1" />{' '}
                {t('dashboard.leaderboard.refresh')}
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {isLoading && !data ? (
            <div className="flex h-32 items-center justify-center">
              <Spinner className="size-6 text-muted-foreground" />
            </div>
          ) : error && !data ? (
            <div className="flex flex-col h-32 items-center justify-center space-y-4">
              <p className="text-sm text-destructive font-medium">
                {t('dashboard.leaderboard.failed_to_load')}
              </p>
              <Button onClick={() => refetch()} variant="outline" size="sm">
                {t('common.retry')}
              </Button>
            </div>
          ) : data ? (
            <div className="space-y-4">
              {error && (
                <div className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md flex items-center justify-between">
                  <span>{t('dashboard.leaderboard.failed_to_refresh')}</span>
                  <Button
                    onClick={() => refetch()}
                    variant="outline"
                    size="sm"
                    className="h-7"
                  >
                    {t('common.retry')}
                  </Button>
                </div>
              )}
              <div className="rounded-xl border bg-card overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted/50 text-xs font-semibold uppercase text-muted-foreground border-b">
                    <tr>
                      <th className="p-3 text-center w-16">
                        {t('dashboard.leaderboard.rank')}
                      </th>
                      <th className="p-3">
                        {t('dashboard.leaderboard.username')}
                      </th>
                      <th className="p-3 text-right w-24">
                        {t('dashboard.leaderboard.points')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {showFloatingCurrentUser && page > 0 && (
                      <LeaderboardRow entry={data.currentUser!} />
                    )}
                    {showFloatingCurrentUser && page > 0 && (
                      <tr>
                        <td
                          colSpan={3}
                          className="p-0 border-b border-dashed border-border"
                        />
                      </tr>
                    )}

                    {data.entries.length > 0 ? (
                      data.entries.map((entry) => (
                        <LeaderboardRow key={entry.rank} entry={entry} />
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={3}
                          className="p-8 text-center text-muted-foreground"
                        >
                          {t('dashboard.leaderboard.no_learners')}
                        </td>
                      </tr>
                    )}

                    {showFloatingCurrentUser && page === 0 && (
                      <tr>
                        <td
                          colSpan={3}
                          className="p-0 border-t border-dashed border-border"
                        />
                      </tr>
                    )}
                    {showFloatingCurrentUser && page === 0 && (
                      <LeaderboardRow entry={data.currentUser!} />
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  {t('common.previous')}
                </Button>
                <div className="text-sm text-muted-foreground">
                  {t('common.page', { page: page + 1 })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!hasMore}
                  onClick={() => setPage((p) => p + 1)}
                >
                  {t('common.next')}
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function LeaderboardRow({ entry }: { entry: LeaderboardEntry }) {
  const { t } = useTranslation();
  const isTop3 = entry.rank <= 3;

  return (
    <tr
      className={`transition-colors ${
        entry.isCurrentUser
          ? 'bg-primary/10 relative after:absolute after:inset-y-0 after:left-0 after:w-1 after:bg-primary'
          : 'hover:bg-muted/30 relative after:absolute after:inset-y-0 after:left-0 after:w-1 after:bg-transparent'
      }`}
    >
      <td
        className={`p-3 text-center font-bold ${
          isTop3
            ? 'text-yellow-600 dark:text-yellow-500'
            : 'text-muted-foreground'
        }`}
      >
        #{entry.rank}
      </td>
      <td
        className={`p-3 font-medium truncate ${
          entry.isCurrentUser ? 'text-primary' : ''
        }`}
      >
        {entry.username}{' '}
        {entry.isCurrentUser && (
          <span className="ml-2 text-xs font-normal text-muted-foreground bg-background px-1.5 py-0.5 rounded-full border">
            {t('dashboard.leaderboard.you')}
          </span>
        )}
      </td>
      <td className="p-3 text-right font-semibold">
        {entry.points.toLocaleString()}
      </td>
    </tr>
  );
}
