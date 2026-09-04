import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Card, Deck } from '@/hooks/useStore';

const routeTestState = vi.hoisted(() => ({
  reviewSession: vi.fn(),
  store: null as Record<string, unknown> | null,
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
  useNavigate: () => vi.fn(),
}));

vi.mock('@/hooks/useStore', () => ({
  useStore: () => routeTestState.store,
}));

vi.mock('@/lib/auth-client', () => ({
  authClient: {
    useSession: () => ({ data: { user: { id: 'user-1' } } }),
  },
}));

vi.mock('@/lib/review-preferences', () => ({
  saveLastReviewDeckId: vi.fn(),
}));

vi.mock('@/components/review/ReviewSession', () => ({
  ReviewSession: ({ cards }: { cards: Card[] }) => {
    routeTestState.reviewSession(cards);
    return <div data-testid="review-session" />;
  },
}));

import { DeckReviewPage } from '@/components/review/DeckReviewPage';

const deck: Deck = {
  id: 'deck-1',
  title: 'German basics',
  description: '',
  created_at: 1,
  updated_at: 1,
};

function makeCard(id: string, dueAt: number): Card {
  return {
    id,
    note_id: `note-${id}`,
    template_key: 'basic:front-back',
    active: true,
    front: id,
    back: id,
    due_at: dueAt,
    scheduled_interval_minutes: 0,
    created_at: 1,
    updated_at: 1,
  };
}

function makeStore(overrides: Record<string, unknown> = {}) {
  return {
    decks: [deck],
    getCardsForDeck: vi.fn(() => []),
    isTakenOver: false,
    error: null,
    ready: true,
    reconnect: vi.fn(),
    createCard: vi.fn(),
    recordReview: vi.fn(),
    deleteNote: vi.fn(),
    ...overrides,
  };
}

describe('DeckReviewRoute', () => {
  beforeEach(() => {
    routeTestState.store = makeStore();
    routeTestState.reviewSession.mockReset();
  });

  it('asks the user to choose a deck when deckId is missing', () => {
    render(<DeckReviewPage />);

    expect(
      screen.getByRole('heading', { name: 'Choose a deck first' }),
    ).toBeInTheDocument();
  });

  it('shows a recovery screen when the selected deck does not exist', () => {
    render(<DeckReviewPage deckId="missing-deck" />);

    expect(
      screen.getByRole('heading', { name: 'Deck not found' }),
    ).toBeInTheDocument();
  });

  it('shows an empty state when the selected deck has no due cards', () => {
    routeTestState.store = makeStore({
      getCardsForDeck: vi.fn(() => [makeCard('future-card', Date.now() + 1)]),
    });

    render(<DeckReviewPage deckId={deck.id} />);

    expect(
      screen.getByRole('heading', { name: 'No cards due' }),
    ).toBeInTheDocument();
  });

  it('passes only due cards from the selected deck into the review session', () => {
    const dueCard = makeCard('due-card', Date.now() - 1);
    const futureCard = makeCard('future-card', Date.now() + 60_000);
    const getCardsForDeck = vi.fn(() => [futureCard, dueCard]);
    routeTestState.store = makeStore({ getCardsForDeck });

    render(<DeckReviewPage deckId={deck.id} />);

    expect(screen.getByTestId('review-session')).toBeInTheDocument();
    expect(getCardsForDeck).toHaveBeenCalledWith(deck.id);
    expect(routeTestState.reviewSession).toHaveBeenCalledWith([dueCard]);
  });

  it('starts a review session with at most ten due cards', async () => {
    const dueCards = Array.from({ length: 12 }, (_, index) =>
      makeCard(`due-${index}`, Date.now() - index - 1),
    );
    routeTestState.store = makeStore({
      getCardsForDeck: vi.fn(() => dueCards),
    });

    render(<DeckReviewPage deckId={deck.id} />);

    await waitFor(() =>
      expect(routeTestState.reviewSession).toHaveBeenLastCalledWith(
        dueCards
          .slice()
          .sort((first, second) => first.due_at - second.due_at)
          .slice(0, 10),
      ),
    );
  });

  it('keeps the initial queue mounted after its last card is no longer due', async () => {
    const dueCard = makeCard('due-card', Date.now() - 1);
    let cards = [dueCard];
    routeTestState.store = makeStore({
      getCardsForDeck: vi.fn(() => cards),
    });

    const { rerender } = render(<DeckReviewPage deckId={deck.id} />);

    await waitFor(() =>
      expect(routeTestState.reviewSession).toHaveBeenCalledWith([dueCard]),
    );

    cards = [];
    await act(async () => {
      rerender(<DeckReviewPage deckId={deck.id} />);
    });

    expect(screen.getByTestId('review-session')).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'No cards due' }),
    ).not.toBeInTheDocument();
    expect(routeTestState.reviewSession).toHaveBeenLastCalledWith([dueCard]);
  });
});
