import type {
  ActivityCard,
  ActivityNote,
  ActivityReviewEvent,
} from './activity.js';
import { MILLISECONDS_PER_DAY, utcDayAt } from './utc-day.js';

const MINUTES_PER_DAY = 1_440;
const MATURE_INTERVAL_MINUTES = 21 * MINUTES_PER_DAY;

export type StatisticsReviewEvent = ActivityReviewEvent;

export type StatisticsNote = ActivityNote;

export interface StatisticsCard extends ActivityCard {
  readonly due_at: number;
  readonly scheduled_interval_minutes: number;
}

export interface StatisticsMembership {
  readonly note_id: string;
  readonly deck_id: string;
  readonly active: boolean;
}

export interface StatisticsRows {
  readonly reviewEvents: readonly StatisticsReviewEvent[];
  readonly cards: readonly StatisticsCard[];
  readonly notes: readonly StatisticsNote[];
}

export interface DailyStatistics {
  readonly utcDate: string;
  readonly reviews: number;
  readonly notesAdded: number;
  readonly forgotRate: number;
}

export function selectStatisticsRowsForDeck(
  reviewEvents: readonly StatisticsReviewEvent[],
  cards: readonly StatisticsCard[],
  notes: readonly StatisticsNote[],
  memberships: readonly StatisticsMembership[],
  deckId?: string,
): StatisticsRows {
  const activeCards = cards.filter((card) => card.active !== false);
  if (deckId === undefined) {
    const cardIds = new Set(activeCards.map((card) => card.id));
    return {
      reviewEvents: reviewEvents.filter((event) =>
        cardIds.has(event.user_card_id),
      ),
      cards: activeCards,
      notes,
    };
  }

  const noteIds = new Set(
    memberships
      .filter(
        (membership) => membership.active && membership.deck_id === deckId,
      )
      .map((membership) => membership.note_id),
  );
  const scopedCards = activeCards.filter((card) => noteIds.has(card.note_id));
  const cardIds = new Set(scopedCards.map((card) => card.id));

  return {
    reviewEvents: reviewEvents.filter((event) =>
      cardIds.has(event.user_card_id),
    ),
    cards: scopedCards,
    notes: notes.filter((note) => noteIds.has(note.id)),
  };
}

export function selectDailyCounts(
  reviewEvents: readonly StatisticsReviewEvent[],
  notes: readonly StatisticsNote[],
  options: { readonly days: number; readonly now: number },
): DailyStatistics[] {
  if (!Number.isInteger(options.days) || options.days < 1) {
    throw new Error('Statistics days must be a positive integer');
  }

  const todayOrdinal = utcDayAt(options.now).ordinal;
  const firstOrdinal = todayOrdinal - options.days + 1;
  const rows = Array.from({ length: options.days }, (_, index) => ({
    utcDate: utcDayAt((firstOrdinal + index) * MILLISECONDS_PER_DAY).key,
    reviews: 0,
    notesAdded: 0,
    forgotRate: 0,
    forgotten: 0,
  }));
  const byDate = new Map(rows.map((row) => [row.utcDate, row]));

  for (const event of reviewEvents) {
    const row = byDate.get(utcDayAt(event.reviewed_at).key);
    if (!row) continue;
    row.reviews += 1;
    if (event.rating === 1) row.forgotten += 1;
  }
  for (const note of notes) {
    const row = byDate.get(utcDayAt(note.created_at).key);
    if (row) row.notesAdded += 1;
  }

  return rows.map(({ forgotten, ...row }) => ({
    ...row,
    forgotRate: row.reviews === 0 ? 0 : forgotten / row.reviews,
  }));
}

export interface MonthlyStatistics {
  /** `YYYY-MM`, the UTC month. */
  readonly utcMonth: string;
  readonly reviews: number;
  readonly notesAdded: number;
  readonly forgotRate: number;
}

function utcMonthKey(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 7);
}

/** The last `months` UTC months, oldest first, for the year view. */
export function selectMonthlyCounts(
  reviewEvents: readonly StatisticsReviewEvent[],
  notes: readonly StatisticsNote[],
  options: { readonly months: number; readonly now: number },
): MonthlyStatistics[] {
  if (!Number.isInteger(options.months) || options.months < 1) {
    throw new Error('Statistics months must be a positive integer');
  }

  const end = new Date(options.now);
  const rows = Array.from({ length: options.months }, (_, index) => {
    const month = new Date(
      Date.UTC(
        end.getUTCFullYear(),
        end.getUTCMonth() - (options.months - 1 - index),
        1,
      ),
    );
    return {
      utcMonth: month.toISOString().slice(0, 7),
      reviews: 0,
      notesAdded: 0,
      forgotRate: 0,
      forgotten: 0,
    };
  });
  const byMonth = new Map(rows.map((row) => [row.utcMonth, row]));

  for (const event of reviewEvents) {
    const row = byMonth.get(utcMonthKey(event.reviewed_at));
    if (!row) continue;
    row.reviews += 1;
    if (event.rating === 1) row.forgotten += 1;
  }
  for (const note of notes) {
    const row = byMonth.get(utcMonthKey(note.created_at));
    if (row) row.notesAdded += 1;
  }

  return rows.map(({ forgotten, ...row }) => ({
    ...row,
    forgotRate: row.reviews === 0 ? 0 : forgotten / row.reviews,
  }));
}

export function selectDueForecast(
  cards: readonly StatisticsCard[],
  options: { readonly now: number },
) {
  const today = utcDayAt(options.now).ordinal;
  const endOfToday = (today + 1) * MILLISECONDS_PER_DAY;
  const endOfTomorrow = (today + 2) * MILLISECONDS_PER_DAY;
  const endOfNextSevenDays = (today + 9) * MILLISECONDS_PER_DAY;
  let dueToday = 0;
  let tomorrow = 0;
  let nextSevenDays = 0;

  for (const card of cards) {
    if (card.active === false) continue;
    if (card.due_at < endOfToday) dueToday += 1;
    else if (card.due_at < endOfTomorrow) tomorrow += 1;
    else if (card.due_at < endOfNextSevenDays) nextSevenDays += 1;
  }

  return { today: dueToday, tomorrow, nextSevenDays };
}

export function selectMaturity(cards: readonly StatisticsCard[]) {
  const counts = { new: 0, learning: 0, young: 0, mature: 0 };

  for (const card of cards) {
    if (card.active === false) continue;
    const interval = card.scheduled_interval_minutes;
    // Sync validation keeps intervals non-negative; a bad row that slipped
    // through should not blank the statistics tab, so it counts as new.
    if (!Number.isFinite(interval) || interval <= 0) counts.new += 1;
    else if (interval < MINUTES_PER_DAY) counts.learning += 1;
    else if (interval < MATURE_INTERVAL_MINUTES) counts.young += 1;
    else counts.mature += 1;
  }

  return counts;
}
