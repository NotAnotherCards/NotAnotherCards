import { render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeckList } from '../components/deck/DeckList';

// The store's due count runs on a clock rounded down to 10 seconds, so a
// card activated in the last few seconds is in the deck's cards but not yet
// in store.dueCards. Start Review must go by the cards themselves.
const NOW = Date.UTC(2026, 9, 4, 12, 0, 5);

type TestCard = {
  id: string;
  note_id: string;
  active: boolean;
  due_at: number;
  front: string;
  back: string;
};
const card = (
  id: string,
  noteId: string,
  active: boolean,
  dueAt: number,
): TestCard => ({
  id,
  note_id: noteId,
  active,
  due_at: dueAt,
  front: `front ${id}`,
  back: `back ${id}`,
});

const decks = [
  { id: 'due', title: 'Due deck', note_type: 'basic' },
  { id: 'just', title: 'Just activated', note_type: 'basic' },
  { id: 'inactive', title: 'Waiting deck', note_type: 'basic' },
  { id: 'future', title: 'Done for now', note_type: 'basic' },
  { id: 'empty', title: 'Empty deck', note_type: 'basic' },
  {
    id: 'words',
    title: 'Word deck',
    note_type: 'word',
    native_language_id: '00000000-0000-0000-0000-000000000001',
    target_language_id: '00000000-0000-0000-0000-000000000002',
  },
].map((deck) => ({ description: '', visibility: 'private', ...deck }));

const cardsByDeck: Record<string, TestCard[]> = {
  due: [card('c1', 'n1', true, NOW - 60_000)],
  // Activated two seconds ago: due, but after the store's rounded clock.
  just: [card('c2', 'n2', true, NOW - 2_000)],
  inactive: [card('c3', 'n3', false, 0)],
  future: [card('c4', 'n4', true, NOW + 86_400_000)],
  empty: [],
  words: [card('c5', 'n5', false, 0), card('c6', 'n5', false, 0)],
};

vi.mock('@/hooks/useStore', () => ({
  useStore: () => ({
    ready: true,
    showSpinner: false,
    isTakenOver: false,
    error: null,
    decks,
    noteDecks: Object.entries(cardsByDeck).flatMap(([deckId, cards]) =>
      [...new Set(cards.map((c) => c.note_id))].map((noteId) => ({
        deck_id: deckId,
        note_id: noteId,
      })),
    ),
    // The store's view: only the card that was due before its rounded clock.
    dueCards: [cardsByDeck.due[0]],
    getCardsForDeck: (deckId: string) => cardsByDeck[deckId] ?? [],
    getCardsWithoutDeck: () => [],
    getNotesForDeck: (deckId: string) =>
      [...new Set((cardsByDeck[deckId] ?? []).map((c) => c.note_id))].map(
        (id) => ({ id }),
      ),
    deckDeletionSummary: vi.fn(),
    profile: null,
  }),
}));

function startReview(title: string) {
  const deckCard = screen
    .getByText(title, { exact: true })
    .closest('[data-slot="card"]') as HTMLElement;
  return within(deckCard).getByRole('button', { name: 'Start Review' });
}

describe('DeckList Start Review', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  it('is on while there is something to review or activate', () => {
    render(
      <DeckList
        onSelectDeck={vi.fn()}
        onSelectNoDeck={vi.fn()}
        onStartReview={vi.fn()}
      />,
    );

    expect(startReview('Due deck')).toBeEnabled();
    expect(startReview('Just activated')).toBeEnabled();
    expect(startReview('Waiting deck')).toBeEnabled();
    expect(startReview('Word deck')).toBeEnabled();
  });

  it('is off when nothing is due now and nothing waits to be activated', () => {
    render(
      <DeckList
        onSelectDeck={vi.fn()}
        onSelectNoDeck={vi.fn()}
        onStartReview={vi.fn()}
      />,
    );

    expect(startReview('Done for now')).toBeDisabled();
    expect(startReview('Empty deck')).toBeDisabled();
  });
});
