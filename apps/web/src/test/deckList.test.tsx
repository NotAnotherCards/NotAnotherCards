import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DeckList } from '../components/deck/DeckList';

vi.mock('@/hooks/useStore', () => ({
  useStore: () => ({
    ready: true,
    showSpinner: false,
    isTakenOver: false,
    error: null,
    decks: [
      {
        id: 'deck-1',
        title: 'Spanish Verbs',
        description: '',
        note_type: 'basic',
        visibility: 'private',
      },
    ],
    noteDecks: [
      { deck_id: 'deck-1', note_id: 'note-1' },
      { deck_id: 'deck-1', note_id: 'note-2' },
    ],
    dueCards: [
      { note_id: 'note-1' },
      { note_id: 'note-1' },
      { note_id: 'note-elsewhere' },
    ],
    getCardsCount: () => 4,
  }),
}));

describe('DeckList', () => {
  it('shows the number of due cards in each deck', () => {
    render(<DeckList onSelectDeck={vi.fn()} onStartReview={vi.fn()} />);

    const badge = screen.getByTestId('due-cards-badge');
    expect(badge).toHaveTextContent('2');
    // a deck with work is emphasised, an empty one is not
    expect(badge).toHaveClass('text-primary');
  });
});
