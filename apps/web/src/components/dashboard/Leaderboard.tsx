import { useState, useMemo } from 'react';
import { useLeaderboard } from '@/hooks/useLeaderboard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Trophy, RefreshCcw, Info } from 'lucide-react';
import { LeaderboardEntry } from '@repo/schemas';

const PAGE_SIZE = 20;

export function Leaderboard() {
  const [page, setPage] = useState(0);
  const { data, isLoading, error, lastUpdated, refetch } = useLeaderboard(
    PAGE_SIZE,
    page * PAGE_SIZE
  );

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
            One distinct completed review earns exactly one point, regardless of rating (ratings only affect scheduling). Ties are sorted by the earliest time the score was reached, and then by public username.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle>Top Learners</CardTitle>
          {lastUpdated && (
            <div className="text-xs text-muted-foreground flex items-center gap-2">
              Snapshot from {new Date(lastUpdated).toLocaleTimeString()}
              <Button variant="ghost" size="sm" onClick={() => refetch()} className="h-6 px-2">
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
              <p className="text-sm text-destructive font-medium">Failed to load leaderboard</p>
              <Button onClick={() => refetch()} variant="outline" size="sm">
                Retry
              </Button>
            </div>
          ) : data ? (
            <div className="space-y-4">
              <div className="rounded-xl border bg-card overflow-hidden">
                <div className="grid grid-cols-[3rem_1fr_4rem] sm:grid-cols-[4rem_1fr_6rem] gap-4 p-3 bg-muted/50 text-xs font-semibold uppercase text-muted-foreground border-b">
                  <div className="text-center">Rank</div>
                  <div>Username</div>
                  <div className="text-right">Points</div>
                </div>
                
                {showFloatingCurrentUser && page > 0 && (
                  <LeaderboardRow entry={data.currentUser!} />
                )}
                {showFloatingCurrentUser && page > 0 && (
                  <div className="border-b border-dashed border-border" />
                )}

                <div className="divide-y">
                  {data.entries.length > 0 ? (
                    data.entries.map((entry) => (
                      <LeaderboardRow key={entry.rank} entry={entry} />
                    ))
                  ) : (
                    <div className="p-8 text-center text-muted-foreground text-sm">
                      No learners found on this page.
                    </div>
                  )}
                </div>

                {showFloatingCurrentUser && page === 0 && (
                  <div className="border-t border-dashed border-border" />
                )}
                {showFloatingCurrentUser && page === 0 && (
                  <LeaderboardRow entry={data.currentUser!} />
                )}
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
                  disabled={data.entries.length < PAGE_SIZE}
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
    <div
      className={`grid grid-cols-[3rem_1fr_4rem] sm:grid-cols-[4rem_1fr_6rem] gap-4 p-3 items-center transition-colors
        ${entry.isCurrentUser ? 'bg-primary/10 border-l-4 border-l-primary' : 'hover:bg-muted/30 border-l-4 border-l-transparent'}`}
    >
      <div className={`text-center font-bold ${isTop3 ? 'text-yellow-600 dark:text-yellow-500' : 'text-muted-foreground'}`}>
        #{entry.rank}
      </div>
      <div className={`font-medium truncate ${entry.isCurrentUser ? 'text-primary' : ''}`}>
        {entry.username} {entry.isCurrentUser && <span className="ml-2 text-xs font-normal text-muted-foreground bg-background px-1.5 py-0.5 rounded-full border">You</span>}
      </div>
      <div className="text-right font-semibold">
        {entry.points.toLocaleString()}
      </div>
    </div>
  );
}
