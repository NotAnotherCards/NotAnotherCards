import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DeckList } from '../components/deck/DeckList';

let cardsWithoutDeck: Array<{ id: string; note_id: string }> = [];

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
    getCardsForDeck: () => [],
    getCardsCount: () => 4,
    getCardsWithoutDeck: () => cardsWithoutDeck,
  }),
}));

describe('DeckList', () => {
  it('shows the number of due cards in each deck', () => {
    render(
      <DeckList
        onSelectDeck={vi.fn()}
        onSelectNoDeck={vi.fn()}
        onStartReview={vi.fn()}
        onStartNoDeckReview={vi.fn()}
      />,
    );

    const badge = screen.getByTestId('due-cards-badge');
    expect(badge).toHaveTextContent('2');
    // a deck with work is accented
    expect(badge).toHaveClass('text-primary');
  });

  it('shows a No deck entry only for cards without an active membership', () => {
    cardsWithoutDeck = [{ id: 'orphan-card', note_id: 'orphan-note' }];
    const onSelectNoDeck = vi.fn();
    const onStartNoDeckReview = vi.fn();

    render(
      <DeckList
        onSelectDeck={vi.fn()}
        onSelectNoDeck={onSelectNoDeck}
        onStartReview={vi.fn()}
        onStartNoDeckReview={onStartNoDeckReview}
      />,
    );

    const noDeckCard = screen
      .getByText(/No deck|Cards and words without a deck/)
      .closest('[data-slot=card]');
    expect(noDeckCard).not.toBeNull();
    fireEvent.click(
      within(noDeckCard as HTMLElement).getByRole('button', {
        name: 'Manage Cards',
      }),
    );
    expect(onSelectNoDeck).toHaveBeenCalledOnce();
    fireEvent.click(
      within(noDeckCard as HTMLElement).getByRole('button', {
        name: 'Start Review',
      }),
    );
    expect(onStartNoDeckReview).toHaveBeenCalledOnce();
    cardsWithoutDeck = [];
  });
});
