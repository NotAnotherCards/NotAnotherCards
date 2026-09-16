import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Statistics } from '@/components/dashboard/Statistics';
import { useStore } from '@/hooks/useStore';

const at = (iso: string) => new Date(iso).getTime();
const reviews = [
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

vi.mock('@/hooks/useStore', () => ({ useStore: vi.fn() }));
vi.mock('@remelondb/core/react', () => ({
  useQuery: () => ({ data: reviews, isLoading: false, error: null }),
}));

describe('Statistics dashboard', () => {
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(at('2026-09-16T12:00:00.000Z'));
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
          due_at: at('2026-09-16T08:00:00.000Z'),
          scheduled_interval_minutes: 0,
        },
        {
          id: 'card-2',
          note_id: 'note-2',
          due_at: at('2026-09-17T08:00:00.000Z'),
          scheduled_interval_minutes: 1_440,
        },
        {
          id: 'card-3',
          note_id: 'note-3',
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

  afterEach(() => {
    vi.restoreAllMocks();
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
    expect(screen.getByTitle('2026-09-16: 50%')).toBeInTheDocument();

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

    await user.click(screen.getByRole('button', { name: '30 days' }));
    expect(screen.getAllByTestId('reviews-bar')).toHaveLength(30);
  });
});
