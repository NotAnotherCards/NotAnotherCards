import { useMemo, useState } from 'react';
import { useQuery } from '@remelondb/core/react';
import {
  getReviewHistoryQuery,
  type ReviewEventRecord,
  selectDailyCounts,
  selectDueForecast,
  selectMaturity,
  selectStatisticsRowsForDeck,
} from '@repo/offline-db';
import {
  selectLearnedNoteCount,
  selectStreakActivity,
} from '@repo/offline-db/activity';
import { useStore } from '@/hooks/useStore';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

type SeriesKey = 'reviews' | 'notesAdded' | 'forgotRate';

// One chart token per series, so the three strips are told apart at a
// glance: reviews, notes added, forgot rate. See docs/design.md, Charts.
const seriesTone: Record<SeriesKey, string> = {
  reviews: 'bg-chart-1',
  notesAdded: 'bg-chart-2',
  forgotRate: 'bg-chart-3',
};

const seriesNoun: Record<SeriesKey, string> = {
  reviews: 'reviews',
  notesAdded: 'notes added',
  forgotRate: 'forgot rate',
};

const shortDate = (utcDate: string) =>
  new Date(`${utcDate}T00:00:00Z`).toLocaleDateString('en', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });

function BarSeries({
  rows,
  valueKey,
  percentage = false,
}: {
  rows: ReturnType<typeof selectDailyCounts>;
  valueKey: SeriesKey;
  percentage?: boolean;
}) {
  const values = rows.map((row) => row[valueKey]);
  const peak = Math.max(...values, 0);
  const ceiling = percentage ? 1 : Math.max(peak, 1);
  const format = (value: number) =>
    percentage
      ? new Intl.NumberFormat('en', {
          style: 'percent',
          maximumFractionDigits: 1,
        }).format(value)
      : value.toLocaleString();
  // Values fit above the bars in the 7-day range only; 30 bars are too narrow.
  const showValues = rows.length <= 7;
  const today = rows.at(-1)?.utcDate;

  if (peak === 0) {
    return (
      <p className="flex h-36 items-center justify-center text-sm text-muted-foreground">
        No {seriesNoun[valueKey]} in this range
      </p>
    );
  }

  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">max {format(ceiling)}</p>
      <div
        className="flex h-36 items-end gap-1"
        role="img"
        aria-label={`${seriesNoun[valueKey]} per day, ${shortDate(rows[0].utcDate)} to ${shortDate(rows[rows.length - 1].utcDate)}, highest ${format(peak)}`}
      >
        {rows.map((row) => {
          const value = row[valueKey];
          const isToday = row.utcDate === today;
          return (
            <div
              key={row.utcDate}
              className="flex min-w-0 flex-1 flex-col items-center justify-end self-stretch"
              title={`${row.utcDate}: ${format(value)}`}
              data-testid={`${valueKey}-bar`}
            >
              {showValues && (
                <span className="text-[10px] leading-4 text-muted-foreground">
                  {format(value)}
                </span>
              )}
              <div
                className={`w-full min-w-1 rounded-t ${seriesTone[valueKey]} ${
                  isToday ? '' : 'opacity-70'
                }`}
                style={{ height: `${(value / ceiling) * 100}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{shortDate(rows[0].utcDate)}</span>
        <span>{shortDate(rows[rows.length - 1].utcDate)} (today)</span>
      </div>
    </div>
  );
}

export function Statistics() {
  const store = useStore();
  const { data: reviewEvents } = useQuery<ReviewEventRecord>(
    store.db && getReviewHistoryQuery(store.db),
  );
  const [days, setDays] = useState<7 | 30>(7);
  const [deckId, setDeckId] = useState('');
  const now = Date.now();
  const rows = useMemo(
    () =>
      selectStatisticsRowsForDeck(
        reviewEvents,
        store.cards,
        store.notes,
        store.noteDecks,
        deckId || undefined,
      ),
    [deckId, reviewEvents, store.cards, store.noteDecks, store.notes],
  );
  const daily = selectDailyCounts(rows.reviewEvents, rows.notes, {
    days,
    now,
  });
  const streak = selectStreakActivity(rows.reviewEvents, now);
  const learnedNotes = selectLearnedNoteCount(
    rows.reviewEvents,
    rows.cards,
    rows.notes,
  );
  const due = selectDueForecast(rows.cards, { now });
  const maturity = selectMaturity(rows.cards);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-heading text-xl font-bold">Your statistics</h2>
          <p className="text-sm text-muted-foreground">
            Activity from the cards stored on this device.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm font-medium">
          Deck
          <select
            aria-label="Statistics deck"
            value={deckId}
            onChange={(event) => setDeckId(event.target.value)}
            className="h-9 rounded-xl border border-input bg-background px-3 text-sm"
          >
            <option value="">All decks</option>
            {store.decks.map((deck) => (
              <option key={deck.id} value={deck.id}>
                {deck.title}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card aria-label="Learning streak">
          <CardHeader>
            <CardTitle>Learning streak</CardTitle>
            <CardDescription>Consecutive UTC learning days</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            <p className="text-2xl font-bold">
              {streak.currentStreak} days current
            </p>
            <p className="text-sm text-muted-foreground">
              {streak.longestStreak} days longest
            </p>
          </CardContent>
        </Card>

        <Card aria-label="Learned notes">
          <CardHeader>
            <CardTitle>Learned notes</CardTitle>
            <CardDescription>Notes with a successful review</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {learnedNotes.toLocaleString()} learned
            </p>
          </CardContent>
        </Card>

        <Card aria-label="Due forecast">
          <CardHeader>
            <CardTitle>Due forecast</CardTitle>
            <CardDescription>Upcoming review workload</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-2 text-center">
            <div>
              <strong className="block text-xl">{due.today}</strong>Today
            </div>
            <div>
              <strong className="block text-xl">{due.tomorrow}</strong>Tomorrow
            </div>
            <div>
              <strong className="block text-xl">{due.nextSevenDays}</strong>Next
              7 days
            </div>
          </CardContent>
        </Card>

        <Card aria-label="Card maturity">
          <CardHeader>
            <CardTitle>Card maturity</CardTitle>
            <CardDescription>By scheduled review interval</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            {Object.entries(maturity).map(([label, value]) => (
              <div
                key={label}
                className="rounded-xl bg-muted/50 p-2 capitalize"
              >
                <strong className="mr-1">{value}</strong>
                <span>{label}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-2" aria-label="Statistics range">
        <Button
          size="sm"
          variant={days === 7 ? 'secondary' : 'ghost'}
          aria-pressed={days === 7}
          onClick={() => setDays(7)}
        >
          7 days
        </Button>
        <Button
          size="sm"
          variant={days === 30 ? 'secondary' : 'ghost'}
          aria-pressed={days === 30}
          onClick={() => setDays(30)}
        >
          30 days
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card aria-label="Reviews per day">
          <CardHeader>
            <CardTitle>Reviews per day</CardTitle>
          </CardHeader>
          <CardContent>
            <BarSeries rows={daily} valueKey="reviews" />
          </CardContent>
        </Card>
        <Card aria-label="Notes added per day">
          <CardHeader>
            <CardTitle>Notes added per day</CardTitle>
          </CardHeader>
          <CardContent>
            <BarSeries rows={daily} valueKey="notesAdded" />
          </CardContent>
        </Card>
        <Card aria-label="Forgot rate per day">
          <CardHeader>
            <CardTitle>Forgot rate per day</CardTitle>
          </CardHeader>
          <CardContent>
            <BarSeries rows={daily} valueKey="forgotRate" percentage />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
