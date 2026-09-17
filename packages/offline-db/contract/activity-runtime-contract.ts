import { selectActivitySummary } from '../src/activity.js';
import {
  selectDailyCounts,
  selectDueForecast,
  selectMaturity,
} from '../src/statistics.js';

const fixtureInputs = [
  {
    reviewEvents: [
      {
        id: 'utc-day-1',
        user_card_id: 'card-1',
        rating: 3,
        reviewed_at: 1_774_650_600_000,
      },
      {
        id: 'utc-day-2',
        user_card_id: 'card-2',
        rating: 3,
        reviewed_at: 1_774_737_000_000,
      },
      {
        id: 'utc-day-3',
        user_card_id: 'inactive-card',
        rating: 3,
        reviewed_at: 1_774_819_800_000,
      },
    ],
    cards: [{ id: 'inactive-card', note_id: 'note-1', active: false }],
    notes: [{ id: 'note-1', created_at: 1_774_818_000_000 }],
    now: 1_774_864_800_000,
  },
  {
    reviewEvents: [
      {
        id: 'utc-review',
        user_card_id: 'inactive-card',
        rating: 4,
        reviewed_at: 1_788_823_800_000,
      },
    ],
    cards: [{ id: 'inactive-card', note_id: 'note-1', active: false }],
    notes: [{ id: 'note-1', created_at: 1_788_826_500_000 }],
    now: 1_788_827_400_000,
  },
] as const;

const expectedResults = [
  {
    reviewPoints: 3,
    reviewCount: 3,
    reviewPointsReachedAt: 1_774_819_800_000,
    currentStreak: 3,
    longestStreak: 3,
    utcDate: '2026-03-30',
    learnedNoteCount: 1,
    todayChallenges: [
      {
        code: 'daily-review',
        current: 0,
        target: 20,
        completed: false,
      },
      {
        code: 'new-vocabulary',
        current: 0,
        target: 5,
        completed: false,
      },
    ],
    eligibleBadgeCodes: ['first-review'],
  },
  {
    reviewPoints: 1,
    reviewCount: 1,
    reviewPointsReachedAt: 1_788_823_800_000,
    currentStreak: 1,
    longestStreak: 1,
    utcDate: '2026-09-08',
    learnedNoteCount: 1,
    todayChallenges: [
      {
        code: 'daily-review',
        current: 0,
        target: 20,
        completed: false,
      },
      {
        code: 'new-vocabulary',
        current: 1,
        target: 5,
        completed: false,
      },
    ],
    eligibleBadgeCodes: ['first-review'],
  },
];

// The statistics selectors (#361) share the UTC day rule; one fixture over
// four days with an overdue, a same-day, a tomorrow and a next-week card.
const statisticsFixture = {
  now: 1_774_864_800_000,
  reviewEvents: [
    ...fixtureInputs[0].reviewEvents,
    {
      id: 'utc-day-4-forgot',
      user_card_id: 'card-1',
      rating: 1,
      reviewed_at: 1_774_861_200_000,
    },
  ],
  notes: fixtureInputs[0].notes,
  cards: [
    {
      id: 'c1',
      note_id: 'n',
      due_at: 1_774_800_000_000,
      scheduled_interval_minutes: 0,
    },
    {
      id: 'c2',
      note_id: 'n',
      due_at: 1_774_900_000_000,
      scheduled_interval_minutes: 600,
    },
    {
      id: 'c3',
      note_id: 'n',
      due_at: 1_774_950_000_000,
      scheduled_interval_minutes: 7_200,
    },
    {
      id: 'c4',
      note_id: 'n',
      due_at: 1_775_300_000_000,
      scheduled_interval_minutes: 43_200,
    },
    {
      id: 'c5',
      note_id: 'n',
      due_at: 1_776_000_000_000,
      scheduled_interval_minutes: 30_240,
    },
  ],
};

const expectedStatistics = {
  daily: [
    { utcDate: '2026-03-27', reviews: 1, notesAdded: 0, forgotRate: 0 },
    { utcDate: '2026-03-28', reviews: 1, notesAdded: 0, forgotRate: 0 },
    { utcDate: '2026-03-29', reviews: 1, notesAdded: 1, forgotRate: 0 },
    { utcDate: '2026-03-30', reviews: 1, notesAdded: 0, forgotRate: 1 },
  ],
  forecast: { today: 2, tomorrow: 1, nextSevenDays: 1 },
  maturity: { new: 1, learning: 1, young: 1, mature: 2 },
};

export function runActivityRuntimeContract() {
  const actual = fixtureInputs.map((input) => selectActivitySummary(input));
  if (JSON.stringify(actual) !== JSON.stringify(expectedResults)) {
    throw new Error(
      `Activity runtime contract mismatch: ${JSON.stringify(actual)}`,
    );
  }
  const statistics = {
    daily: selectDailyCounts(
      statisticsFixture.reviewEvents,
      statisticsFixture.notes,
      { days: 4, now: statisticsFixture.now },
    ),
    forecast: selectDueForecast(statisticsFixture.cards, {
      now: statisticsFixture.now,
    }),
    maturity: selectMaturity(statisticsFixture.cards),
  };
  if (JSON.stringify(statistics) !== JSON.stringify(expectedStatistics)) {
    throw new Error(
      `Statistics runtime contract mismatch: ${JSON.stringify(statistics)}`,
    );
  }
  return { activity: actual, statistics };
}

const output = JSON.stringify(runActivityRuntimeContract());

if (typeof document !== 'undefined') {
  document.body.textContent = output;
} else if (typeof print === 'function') {
  print(output);
} else {
  console.log(output);
}
