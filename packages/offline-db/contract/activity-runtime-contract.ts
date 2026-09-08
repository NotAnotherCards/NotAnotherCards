import { selectActivitySummary } from '../src/activity.js';

const fixtureInputs = [
  {
    reviewEvents: [
      {
        id: 'berlin-day-1',
        user_card_id: 'card-1',
        rating: 3,
        reviewed_at: 1_774_650_600_000,
      },
      {
        id: 'berlin-day-2',
        user_card_id: 'card-2',
        rating: 3,
        reviewed_at: 1_774_737_000_000,
      },
      {
        id: 'berlin-day-3',
        user_card_id: 'inactive-card',
        rating: 3,
        reviewed_at: 1_774_819_800_000,
      },
    ],
    cards: [{ id: 'inactive-card', note_id: 'note-1', active: false }],
    notes: [{ id: 'note-1', created_at: 1_774_818_000_000 }],
    now: 1_774_864_800_000,
    timeZone: 'Europe/Berlin',
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
    timeZone: 'Not/A_Timezone',
  },
] as const;

const expectedResults = [
  {
    reviewPoints: 9,
    reviewCount: 3,
    reviewPointsReachedAt: 1_774_819_800_000,
    currentStreak: 3,
    longestStreak: 3,
    timeZone: 'Europe/Berlin',
    localDate: '2026-03-30',
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
    reviewPoints: 4,
    reviewCount: 1,
    reviewPointsReachedAt: 1_788_823_800_000,
    currentStreak: 1,
    longestStreak: 1,
    timeZone: 'UTC',
    localDate: '2026-09-08',
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

export function runActivityRuntimeContract() {
  const actual = fixtureInputs.map((input) => selectActivitySummary(input));
  if (JSON.stringify(actual) !== JSON.stringify(expectedResults)) {
    throw new Error(
      `Activity runtime contract mismatch: ${JSON.stringify(actual)}`,
    );
  }
  return actual;
}

const output = JSON.stringify(runActivityRuntimeContract());

if (typeof document !== 'undefined') {
  document.body.textContent = output;
} else if (typeof print === 'function') {
  print(output);
} else {
  console.log(output);
}
