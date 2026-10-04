import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Statistics } from '@/components/dashboard/Statistics';
import { useStore } from '@/hooks/useStore';
import i18n from '@/lib/i18n';

const at = (iso: string) => new Date(iso).getTime();
const defaultReviews = [
  {
    id: 'today-forgot',
    user_card_id: 'card-1',
    rating: 1,
    reviewed_at: at('2026-09-16T10:00:00.000Z'),
  },
  {
    id: 'today-learned',
    user_card_id: 'card-2',
    rating: 3,
    reviewed_at: at('2026-09-16T11:00:00.000Z'),
  },
  {
    id: 'yesterday',
    user_card_id: 'card-2',
    rating: 3,
    reviewed_at: at('2026-09-15T11:00:00.000Z'),
  },
];
let reviews = defaultReviews;
const reviewsForStreak = (days: number) =>
  Array.from({ length: days }, (_, index) => ({
    id: `day-${index}`,
    user_card_id: 'card-1',
    rating: 3,
    reviewed_at: at(
      `2026-09-${String(16 - index).padStart(2, '0')}T10:00:00.000Z`,
    ),
  }));

vi.mock('@/hooks/useStore', () => ({ useStore: vi.fn() }));
vi.mock('@remelondb/core/react', () => ({
  useQuery: () => ({ data: reviews, isLoading: false, error: null }),
}));

describe('Statistics dashboard', () => {
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(at('2026-09-16T12:00:00.000Z'));
    reviews = defaultReviews;
    vi.mocked(useStore).mockReturnValue({
      db: null,
      decks: [
        { id: 'deck-1', title: 'Deck one' },
        { id: 'deck-2', title: 'Deck two' },
      ],
      notes: [
        { id: 'note-1', created_at: at('2026-09-16T09:00:00.000Z') },
        { id: 'note-2', created_at: at('2026-09-15T09:00:00.000Z') },
        { id: 'note-3', created_at: at('2026-09-14T09:00:00.000Z') },
      ],
      cards: [
        {
          id: 'card-1',
          note_id: 'note-1',
          active: true,
          front: 'front',
          back: 'back',
          due_at: at('2026-09-16T08:00:00.000Z'),
          scheduled_interval_minutes: 0,
        },
        {
          id: 'card-2',
          note_id: 'note-2',
          active: true,
          front: 'front',
          back: 'back',
          due_at: at('2026-09-17T08:00:00.000Z'),
          scheduled_interval_minutes: 1_440,
        },
        {
          id: 'card-3',
          note_id: 'note-3',
          active: true,
          front: 'front',
          back: 'back',
          due_at: at('2026-09-18T08:00:00.000Z'),
          scheduled_interval_minutes: 21 * 1_440,
        },
      ],
      noteDecks: [
        { note_id: 'note-1', deck_id: 'deck-1', active: true },
        { note_id: 'note-2', deck_id: 'deck-1', active: true },
        { note_id: 'note-3', deck_id: 'deck-2', active: true },
      ],
    } as unknown as ReturnType<typeof useStore>);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await i18n.changeLanguage('en');
  });

  it.each([
    [1, 'en', '1 day current', '1 day longest'],
    [2, 'en', '2 days current', '2 days longest'],
    [5, 'en', '5 days current', '5 days longest'],
    [1, 'ru', '1 день сейчас', '1 день максимум'],
    [2, 'ru', '2 дня сейчас', '2 дня максимум'],
    [5, 'ru', '5 дней сейчас', '5 дней максимум'],
    [1, 'de', '1 Tag aktuell', '1 Tag am längsten'],
    [2, 'de', '2 Tage aktuell', '2 Tage am längsten'],
    [5, 'de', '5 Tage aktuell', '5 Tage am längsten'],
    [1, 'es', '1 día actual', '1 día máximo'],
    [2, 'es', '2 días actual', '2 días máximo'],
    [5, 'es', '5 días actual', '5 días máximo'],
  ])('renders a %i-day streak in %s', async (days, locale, current, longest) => {
    reviews = reviewsForStreak(days);
    await i18n.changeLanguage(locale);

    render(<Statistics />);

    expect(
      within(screen.getByLabelText('Learning streak')).getByText(current),
    ).toBeInTheDocument();
    expect(
      within(screen.getByLabelText('Learning streak')).getByText(longest),
    ).toBeInTheDocument();
  });

  it('renders fixture statistics, scopes by deck, and switches range', async () => {
    const user = userEvent.setup();
    render(<Statistics />);

    expect(
      within(screen.getByLabelText('Learning streak')).getByText(
        '2 days current',
      ),
    ).toBeInTheDocument();
    expect(
      within(screen.getByLabelText('Learned notes')).getByText('1 learned'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByLabelText('Due forecast')).getByText('Next 7 days'),
    ).toHaveTextContent('1Next 7 days');
    expect(screen.getAllByTestId('reviews-bar')).toHaveLength(7);
    expect(screen.getByTitle('Sep 16: 50%')).toBeInTheDocument();
    // Annotations: a described series and the range ending today.
    expect(
      screen.getByRole('img', { name: /Reviews per day, .* highest 2/ }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByLabelText('Reviews per day')).getByText('Sep 16'),
    ).toBeInTheDocument();

    await user.selectOptions(
      screen.getByLabelText('Statistics deck'),
      'deck-1',
    );
    expect(
      within(screen.getByLabelText('Due forecast')).getByText('Next 7 days'),
    ).toHaveTextContent('0Next 7 days');
    expect(
      within(screen.getByLabelText('Card maturity')).getByText('mature')
        .previousSibling,
    ).toHaveTextContent('0');

    await user.click(screen.getByRole('button', { name: 'Month' }));
    expect(screen.getAllByTestId('reviews-bar')).toHaveLength(30);

    await user.click(screen.getByRole('button', { name: 'Year' }));
    expect(screen.getAllByTestId('reviews-bar')).toHaveLength(12);
    expect(screen.getAllByTitle(/Sep 26: /).length).toBeGreaterThan(0);
  });
});
