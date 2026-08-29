import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ReviewSession } from '@/components/review/ReviewSession';
import type { Card } from '@/hooks/useStore';

const card: Card = {
  id: 'card-1',
  deck_id: 'deck-1',
  front: 'gehen',
  back: 'to go',
  due_at: Date.now(),
  created_at: Date.now(),
  updated_at: Date.now(),
};

const secondCard: Card = {
  ...card,
  id: 'card-2',
  front: 'sein',
  back: 'to be',
};

function renderSession(cards: Card[] = [card]) {
  const onExit = vi.fn();
  render(<ReviewSession cards={cards} onExit={onExit} />);
  return { onExit };
}

function revealCard() {
  fireEvent.click(screen.getByTestId('review-card'));
}

describe('ReviewSession', () => {
  it('shows the card front first and reveals both sides on click', () => {
    renderSession();

    expect(screen.getByText('gehen')).toBeInTheDocument();
    revealCard();

    expect(screen.getByText('gehen')).toBeInTheDocument();
    expect(screen.getByText('to go')).toBeInTheDocument();
  });

  it.each([' ', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'])(
    'reveals the answer with %s on the card front',
    (key) => {
      renderSession();

      fireEvent.keyDown(window, { key, code: key === ' ' ? 'Space' : key });
      expect(screen.getByText('to go')).toBeInTheDocument();
    },
  );

  it('reveals the answer after an upward swipe on the card front', () => {
    renderSession();
    const reviewCard = screen.getByTestId('review-card');

    fireEvent.pointerDown(reviewCard, { clientX: 200, clientY: 200 });
    fireEvent.pointerUp(reviewCard, { clientX: 200, clientY: 120 });

    expect(screen.getByText('to go')).toBeInTheDocument();
  });

  it('reveals the answer after a downward swipe on the card front', () => {
    renderSession();
    const reviewCard = screen.getByTestId('review-card');

    fireEvent.pointerDown(reviewCard, { clientX: 200, clientY: 200 });
    fireEvent.pointerUp(reviewCard, { clientX: 200, clientY: 280 });

    expect(screen.getByText('to go')).toBeInTheDocument();
  });

  it('does not move or show swipe feedback on the card front', () => {
    renderSession();
    const reviewCard = screen.getByTestId('review-card');

    fireEvent.pointerDown(reviewCard, { clientX: 200, clientY: 200 });
    fireEvent.pointerMove(reviewCard, { clientX: 320, clientY: 200 });

    expect(screen.queryByTestId('swipe-feedback')).not.toBeInTheDocument();
    expect(screen.getByTestId('review-card-surface')).not.toHaveAttribute(
      'style',
    );
  });

  it.each([
    ['Forgot', 'ArrowLeft'],
    ['Hard', 'ArrowUp'],
    ['Easy', 'ArrowRight'],
  ])('moves to the next card after %s', (_, key) => {
    renderSession([card, secondCard]);
    revealCard();

    fireEvent.keyDown(window, { key });

    expect(screen.getByText('sein')).toBeInTheDocument();
    expect(screen.queryByText('to be')).not.toBeInTheDocument();
  });

  it('moves to the next card after using a visible answer button', () => {
    renderSession([card, secondCard]);
    revealCard();

    fireEvent.click(screen.getByRole('button', { name: 'Hard' }));

    expect(screen.getByText('sein')).toBeInTheDocument();
  });

  it('shows the matching feedback while dragging the answer side', () => {
    renderSession();
    revealCard();
    const reviewCard = screen.getByTestId('review-card');

    fireEvent.pointerDown(reviewCard, { clientX: 200, clientY: 200 });
    fireEvent.pointerMove(reviewCard, { clientX: 140, clientY: 200 });

    expect(screen.getByTestId('swipe-feedback')).toHaveTextContent('Forgot');
    expect(screen.getByTestId('swipe-feedback')).toHaveClass(
      'text-destructive',
    );
    expect(screen.getByTestId('review-card-surface')).toHaveStyle({
      transform: 'translate3d(-60px, 0px, 0) rotate(-2.5deg)',
    });

    fireEvent.pointerCancel(reviewCard);
    expect(screen.queryByTestId('swipe-feedback')).not.toBeInTheDocument();
    expect(screen.getByTestId('review-card-surface')).toHaveStyle({
      transform: 'translate3d(0px, 0px, 0) rotate(0deg)',
    });
  });

  it('shows swipe feedback immediately while dragging down', () => {
    renderSession();
    revealCard();
    const reviewCard = screen.getByTestId('review-card');

    fireEvent.pointerDown(reviewCard, { clientX: 200, clientY: 200 });
    fireEvent.pointerMove(reviewCard, { clientX: 200, clientY: 201 });

    expect(screen.getByTestId('swipe-feedback')).toHaveTextContent(
      'Delete word',
    );
    expect(screen.getByTestId('review-answer-buttons')).toBeVisible();
  });

  it('moves the answer card only along the dominant drag direction', () => {
    renderSession();
    revealCard();
    const reviewCard = screen.getByTestId('review-card');

    fireEvent.pointerDown(reviewCard, { clientX: 200, clientY: 200 });
    fireEvent.pointerMove(reviewCard, { clientX: 140, clientY: 160 });

    expect(screen.getByTestId('review-card-surface')).toHaveStyle({
      transform: 'translate3d(-60px, 0px, 0) rotate(-2.5deg)',
    });

    fireEvent.pointerCancel(reviewCard);
    fireEvent.pointerDown(reviewCard, { clientX: 200, clientY: 200 });
    fireEvent.pointerMove(reviewCard, { clientX: 220, clientY: 120 });

    expect(screen.getByTestId('review-card-surface')).toHaveStyle({
      transform: 'translate3d(0px, -72px, 0) rotate(0deg)',
    });
  });

  it('recenters before moving the card in a new swipe direction', () => {
    renderSession();
    revealCard();
    const reviewCard = screen.getByTestId('review-card');
    const cardSurface = screen.getByTestId('review-card-surface');

    fireEvent.pointerDown(reviewCard, { clientX: 200, clientY: 200 });
    fireEvent.pointerMove(reviewCard, { clientX: 140, clientY: 200 });
    expect(cardSurface).toHaveStyle({
      transform: 'translate3d(-60px, 0px, 0) rotate(-2.5deg)',
    });

    fireEvent.pointerMove(reviewCard, { clientX: 200, clientY: 120 });
    expect(cardSurface).toHaveStyle({
      transform: 'translate3d(0px, 0px, 0) rotate(0deg)',
    });

    fireEvent.transitionEnd(cardSurface);
    fireEvent.pointerMove(reviewCard, { clientX: 200, clientY: 60 });
    expect(cardSurface).toHaveStyle({
      transform: 'translate3d(0px, -60px, 0) rotate(0deg)',
    });
  });

  it('shows the settings button only after the card is revealed', () => {
    renderSession();

    expect(
      screen.queryByRole('button', { name: 'Card menu coming soon' }),
    ).not.toBeInTheDocument();

    revealCard();

    expect(
      screen.getByRole('button', { name: 'Card menu coming soon' }),
    ).toBeDisabled();
  });

  it('opens word details and returns to the same answer view when closed', () => {
    renderSession();
    revealCard();

    fireEvent.click(screen.getByRole('button', { name: 'Show more details' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'Close word details' }),
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('to go')).toBeInTheDocument();
  });

  it('starts the delete placeholder flow with Down Arrow', () => {
    renderSession();
    revealCard();

    fireEvent.keyDown(window, { key: 'ArrowDown' });
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Yes' }));
    expect(
      screen.getByRole('heading', { name: 'Deletion is not available yet' }),
    ).toBeInTheDocument();
  });

  it('returns to the dashboard', () => {
    const { onExit } = renderSession();

    fireEvent.click(
      screen.getByRole('button', { name: 'Back to dashboard' }),
    );
    expect(onExit).toHaveBeenCalledOnce();
  });

  it('shows the completed-session state when the session has no cards', () => {
    renderSession([]);

    expect(
      screen.getByRole('heading', { name: 'Review complete' }),
    ).toBeInTheDocument();
  });
});
