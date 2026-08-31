import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DeckDetail } from '@/components/deck/DeckDetail';

const store = vi.hoisted(() => {
  const card = {
    id: 'card-1',
    note_id: 'note-1',
    template_key: 'front-back',
    active: true,
    front: 'front',
    back: 'back',
    due_at: 0,
    scheduled_interval_minutes: 0,
    created_at: 0,
    updated_at: 0,
  };
  return {
    card,
    isTakenOver: false,
    ready: true,
    showSpinner: false,
    decks: [
      {
        id: 'deck-1',
        title: 'Deck One',
        description: null,
        created_at: 0,
        updated_at: 0,
      },
    ],
    getCardsForDeck: vi.fn(() => [card]),
    isBasicCard: vi.fn(() => true),
    createCard: vi.fn(),
    updateCard: vi.fn(),
    removeNoteFromDeck: vi.fn(),
    error: null,
  };
});

vi.mock('@/hooks/useStore', () => ({
  useStore: () => store,
}));

describe('deck note actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store.isBasicCard.mockReturnValue(true);
    store.removeNoteFromDeck.mockResolvedValue(undefined);
  });

  it('explains and performs a membership-only removal', async () => {
    render(<DeckDetail deckId="deck-1" onBack={vi.fn()} />);

    fireEvent.click(screen.getByTitle('Remove from Deck'));

    expect(screen.getByText('Remove Note from Deck?')).toBeInTheDocument();
    expect(
      screen.getByText(/note, its cards, schedule, and review history/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/permanently delete/i)).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByText('Remove from Deck', { selector: 'button' }),
    );

    await waitFor(() =>
      expect(store.removeNoteFromDeck).toHaveBeenCalledWith('note-1', 'deck-1'),
    );
  });

  it('does not offer the basic editor for a structured note card', () => {
    store.isBasicCard.mockReturnValue(false);

    render(<DeckDetail deckId="deck-1" onBack={vi.fn()} />);

    expect(screen.queryByTitle('Edit Card')).not.toBeInTheDocument();
    expect(screen.getByTitle('Remove from Deck')).toBeInTheDocument();
  });
});
