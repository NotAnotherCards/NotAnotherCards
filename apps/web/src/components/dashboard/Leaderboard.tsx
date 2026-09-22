import { useState, useMemo } from 'react';
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
            Global Leaderboard
          </h2>
          <p className="text-sm text-muted-foreground">
            See how you rank against other learners.
          </p>
        </div>
      </div>

      <Card className="bg-muted/30 border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Info className="size-4" />
            How scoring works
          </CardTitle>
          <CardDescription>
            One distinct completed review earns exactly one point, regardless of
            rating (ratings only affect scheduling). Ties are sorted by the
            earliest time the score was reached, and then by public username.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle>Top Learners</CardTitle>
          {lastUpdated && (
            <div className="text-xs text-muted-foreground flex items-center gap-2">
              Snapshot from {new Date(lastUpdated).toLocaleTimeString()}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => refetch()}
                className="h-6 px-2"
              >
                <RefreshCcw className="size-3 mr-1" /> Refresh
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {isLoading && !data ? (
            <div className="flex h-32 items-center justify-center">
              <Spinner className="size-6 text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="flex flex-col h-32 items-center justify-center space-y-4">
              <p className="text-sm text-destructive font-medium">
                Failed to load leaderboard
              </p>
              <Button onClick={() => refetch()} variant="outline" size="sm">
                Retry
              </Button>
            </div>
          ) : data ? (
            <div className="space-y-4">
              <div className="rounded-xl border bg-card overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted/50 text-xs font-semibold uppercase text-muted-foreground border-b">
                    <tr>
                      <th className="p-3 text-center w-16">Rank</th>
                      <th className="p-3">Username</th>
                      <th className="p-3 text-right w-24">Points</th>
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
                          No learners found on this page.
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
                  Previous
                </Button>
                <div className="text-sm text-muted-foreground">
                  Page {page + 1}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!hasMore}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
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
            You
          </span>
        )}
      </td>
      <td className="p-3 text-right font-semibold">
        {entry.points.toLocaleString()}
      </td>
    </tr>
  );
}
