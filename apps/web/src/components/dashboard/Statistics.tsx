import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@remelondb/core/react';
import {
  getReviewHistoryQuery,
  type ReviewEventRecord,
  selectDailyCounts,
  selectDueForecast,
  selectMaturity,
  selectMonthlyCounts,
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
import {
  Activity,
  Brain,
  CalendarClock,
  FilePlus,
  Flame,
  Sprout,
  TrendingDown,
} from 'lucide-react';
import { formatDate, formatNumber } from '@repo/i18n';

type SeriesKey = 'reviews' | 'notesAdded' | 'forgotRate';

// One chart token per series, so the three strips are told apart at a
// glance: reviews, notes added, forgot rate. See docs/design.md, Charts.
const seriesTone: Record<SeriesKey, string> = {
  reviews: 'bg-chart-1',
  notesAdded: 'bg-chart-2',
  forgotRate: 'bg-chart-3',
};

function getRanges(t: (key: string) => string) {
  return [
    { value: 'week', label: t('dashboard.statistics.ranges.week') },
    { value: 'month', label: t('dashboard.statistics.ranges.month') },
    { value: 'year', label: t('dashboard.statistics.ranges.year') },
  ] as const;
}

const monthLabel = (utcMonth: string, locale: string) =>
  formatDate(new Date(`${utcMonth}-01T00:00:00Z`), locale, {
    month: 'short',
    year: '2-digit',
    timeZone: 'UTC',
  });

const shortDate = (utcDate: string, locale: string) =>
  formatDate(new Date(`${utcDate}T00:00:00Z`), locale, {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });

type SeriesRow = {
  readonly key: string;
  readonly label: string;
  readonly reviews: number;
  readonly notesAdded: number;
  readonly forgotRate: number;
};

function BarSeries({
  rows,
  valueKey,
  percentage = false,
  locale,
  t,
}: {
  rows: readonly SeriesRow[];
  valueKey: SeriesKey;
  percentage?: boolean;
  locale: string;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  const values = rows.map((row) => row[valueKey]);
  const peak = Math.max(...values, 0);
  const ceiling = percentage ? 1 : Math.max(peak, 1);
  const format = (value: number) =>
    percentage
      ? formatNumber(value, locale, {
          style: 'percent',
          maximumFractionDigits: 1,
        })
      : formatNumber(value, locale);
  // Values fit above the bars in the 7-day range only; 30 bars are too narrow.
  const showValues = rows.length <= 7;
  const latest = rows.at(-1)?.key;

  if (peak === 0) {
    return (
      <p className="flex h-36 items-center justify-center text-sm text-muted-foreground">
        {t('dashboard.statistics.empty', {
          series: t(`dashboard.statistics.series.${valueKey}`),
        })}
      </p>
    );
  }

  return (
    <div className="space-y-1">
      <div
        className="flex h-36 items-end gap-1"
        role="img"
        aria-label={`${t(`dashboard.statistics.series.${valueKey}`)}, ${rows[0].label} to ${rows[rows.length - 1].label}, highest ${format(peak)}`}
      >
        {rows.map((row) => {
          const value = row[valueKey];
          const isLatest = row.key === latest;
          return (
            <div
              key={row.key}
              className="flex min-w-0 flex-1 flex-col items-center justify-end self-stretch"
              title={`${row.label}: ${format(value)}`}
              data-testid={`${valueKey}-bar`}
            >
              {showValues && (
                <span className="text-[10px] leading-4 text-muted-foreground">
                  {format(value)}
                </span>
              )}
              <div
                className={`w-full min-w-1 rounded-t ${seriesTone[valueKey]} ${
                  isLatest ? '' : 'opacity-70'
                }`}
                style={{ height: `${(value / ceiling) * 100}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{rows[0].label}</span>
        <span>{rows[rows.length - 1].label}</span>
      </div>
    </div>
  );
}

export function Statistics() {
  const { t } = useTranslation();
  const store = useStore();
  const { data: reviewEvents } = useQuery<ReviewEventRecord>(
    store.db && getReviewHistoryQuery(store.db),
  );
  const [range, setRange] = useState<'week' | 'month' | 'year'>('week');
  const [deckId, setDeckId] = useState('');
  const { i18n } = useTranslation();
  const locale = i18n.resolvedLanguage || 'en';
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
  const series: SeriesRow[] =
    range === 'year'
      ? selectMonthlyCounts(rows.reviewEvents, rows.notes, {
          months: 12,
          now,
        }).map((row) => ({
          ...row,
          key: row.utcMonth,
          label: monthLabel(row.utcMonth, locale),
        }))
      : selectDailyCounts(rows.reviewEvents, rows.notes, {
          days: range === 'week' ? 7 : 30,
          now,
        }).map((row) => ({
          ...row,
          key: row.utcDate,
          label: shortDate(row.utcDate, locale),
        }));
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
          <h2 className="font-heading text-xl font-bold">
            {t('dashboard.statistics.title')}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t('dashboard.statistics.description')}
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm font-medium">
          {t('dashboard.statistics.deck_label')}
          <select
            aria-label="Statistics deck"
            value={deckId}
            onChange={(event) => setDeckId(event.target.value)}
            className="h-9 rounded-xl border border-input bg-background px-3 text-sm"
          >
            <option value="">{t('dashboard.statistics.all_decks')}</option>
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
            <CardTitle className="flex items-center gap-2">
              <Flame className="h-5 w-5 text-orange-500" />
              {t('dashboard.statistics.learning_streak')}
            </CardTitle>
            <CardDescription>
              {t('dashboard.statistics.consecutive_days')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            <p className="text-2xl font-bold">
              {streak.currentStreak === 1
                ? t('dashboard.statistics.days_current_one')
                : t('dashboard.statistics.days_current_other', {
                    count: streak.currentStreak,
                  })}
            </p>
            <p className="text-sm text-muted-foreground">
              {streak.longestStreak === 1
                ? t('dashboard.statistics.days_longest_one')
                : t('dashboard.statistics.days_longest_other', {
                    count: streak.longestStreak,
                  })}
            </p>
          </CardContent>
        </Card>

        <Card aria-label="Learned notes">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-blue-500" />
              {t('dashboard.statistics.learned_notes')}
            </CardTitle>
            <CardDescription>
              {t('dashboard.statistics.learned_description')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {t('dashboard.statistics.learned_value', {
                value: formatNumber(learnedNotes, locale),
              })}
            </p>
          </CardContent>
        </Card>

        <Card aria-label="Due forecast">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-purple-500" />
              {t('dashboard.statistics.due_forecast')}
            </CardTitle>
            <CardDescription>
              {t('dashboard.statistics.due_forecast_description')}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-2 text-center">
            <div>
              <strong className="block text-xl">{due.today}</strong>
              {t('dashboard.statistics.today')}
            </div>
            <div>
              <strong className="block text-xl">{due.tomorrow}</strong>
              {t('dashboard.statistics.tomorrow')}
            </div>
            <div>
              <strong className="block text-xl">{due.nextSevenDays}</strong>
              {t('dashboard.statistics.next_7_days')}
            </div>
          </CardContent>
        </Card>

        <Card aria-label="Card maturity">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sprout className="h-5 w-5 text-green-500" />
              {t('dashboard.statistics.card_maturity')}
            </CardTitle>
            <CardDescription>
              {t('dashboard.statistics.card_maturity_description')}
            </CardDescription>
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
        {getRanges(t).map(({ value, label }) => (
          <Button
            key={value}
            size="sm"
            variant={range === value ? 'secondary' : 'ghost'}
            aria-pressed={range === value}
            onClick={() => setRange(value)}
          >
            {label}
          </Button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card aria-label="Reviews per day">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-chart-1" />
              {t('dashboard.statistics.series.reviews')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <BarSeries rows={series} valueKey="reviews" locale={locale} t={t} />
          </CardContent>
        </Card>
        <Card aria-label="Notes added per day">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FilePlus className="h-5 w-5 text-chart-2" />
              {t('dashboard.statistics.series.notesAdded')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <BarSeries
              rows={series}
              valueKey="notesAdded"
              locale={locale}
              t={t}
            />
          </CardContent>
        </Card>
        <Card aria-label="Forgot rate per day">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-chart-3" />
              {t('dashboard.statistics.series.forgotRate')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <BarSeries
              rows={series}
              valueKey="forgotRate"
              percentage
              locale={locale}
              t={t}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
