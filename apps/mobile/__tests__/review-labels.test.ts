import { createInstance } from 'i18next';
import { catalogs } from '@repo/i18n';
import { reviewAnswerLabel, reviewIntervalLabel } from '@/lib/review-labels';
import { syncStatusView } from '@/lib/sync-status';
import type { SyncControllerState } from '@remelondb/core';

it('uses Spanish review labels and localized intervals', async () => {
  const i18n = createInstance();
  await i18n.init({ resources: catalogs, lng: 'es', showSupportNotice: false });
  expect(reviewAnswerLabel(i18n.t, 'hard', true)).toBe(
    catalogs.es.translation.review.answers.hard,
  );
  expect(reviewIntervalLabel(120, i18n.t)).toBe('2 horas');
  await i18n.changeLanguage('de');
  expect(reviewIntervalLabel(1440, i18n.t)).toBe('1 Tag');
});

it.each([
  ['en', '21 days'],
  ['de', '21 Tage'],
  ['es', '21 días'],
  ['ru', '21 день'],
])(
  'formats intervals in %s without native unit formatting',
  async (lng, expected) => {
    const i18n = createInstance();
    await i18n.init({ resources: catalogs, lng, showSupportNotice: false });
    const format = jest.spyOn(Intl, 'NumberFormat').mockImplementation(() => {
      throw new Error('Unit formatting unavailable');
    });
    try {
      expect(reviewIntervalLabel(21 * 1440, i18n.t)).toBe(expected);
      expect(format).not.toHaveBeenCalled();
    } finally {
      format.mockRestore();
    }
  },
);

it.each([21, 31, 101])(
  'keeps the real Russian count %i in singular-category dashboard labels',
  async (count) => {
    const i18n = createInstance();
    await i18n.init({
      resources: catalogs,
      lng: 'ru',
      showSupportNotice: false,
    });
    for (const [key, word] of [
      ['words', 'слово'],
      ['days', 'день'],
      ['cards', 'карточка'],
    ] as const) {
      expect(i18n.t(`dashboard.overview.stats.${key}`, { count })).toBe(
        `${count} ${word}`,
      );
    }
  },
);

it('pluralizes Russian refused cards and translates the explanation', async () => {
  const i18n = createInstance();
  await i18n.init({ resources: catalogs, lng: 'ru', showSupportNotice: false });
  const state: SyncControllerState = {
    status: 'idle',
    lastSyncAt: null,
    error: null,
    cause: null,
    lastResult: {
      rejected: 2,
      rejectedRecords: { user_cards: ['a', 'b'] },
      resynced: false,
      lease: 'acquired',
    },
  };
  expect(syncStatusView(state, i18n.t).details).toMatch(
    /^2 карточки\. Сервер отклонил/,
  );
});
