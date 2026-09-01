import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReviewSession } from '@/components/review/ReviewSession';
import type { Card } from '@/hooks/useStore';

const card: Card = {
  id: 'card-1',
  note_id: 'note-1',
  template_key: 'basic:front-back',
  active: true,
  front: 'gehen',
  back: 'to go',
  due_at: Date.now(),
  scheduled_interval_minutes: 0,
  created_at: Date.now(),
  updated_at: Date.now(),
};

const secondCard: Card = {
  ...card,
  id: 'card-2',
  front: 'sein',
  back: 'to be',
};

function renderSession(
  cards: Card[] = [card],
  onCreateCard = vi.fn().mockResolvedValue(undefined),
) {
  const onExit = vi.fn();
  render(
    <ReviewSession
      cards={cards}
      onExit={onExit}
      onCreateCard={onCreateCard}
    />,
  );
  return { onCreateCard, onExit };
}

function revealCard() {
  fireEvent.click(screen.getByTestId('review-card'));
}

function finishCardExit() {
  act(() => {
    vi.runOnlyPendingTimers();
  });
}

describe('ReviewSession', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });
  it('shows the card front first and reveals both sides on click', () => {
    renderSession();

    expect(screen.getAllByText('gehen')).not.toHaveLength(0);
    revealCard();

    expect(screen.getAllByText('gehen')).not.toHaveLength(0);
    expect(screen.getByText('to go')).toBeInTheDocument();
  });

  it('turns one card over in 300 milliseconds when the answer is revealed', () => {
    renderSession();

    const flip = screen.getByTestId('review-card-flip');
    expect(flip).toHaveAttribute('data-flipped', 'false');
    expect(flip).toHaveStyle({ transitionDuration: '300ms' });

    revealCard();

    expect(flip).toHaveAttribute('data-flipped', 'true');
    expect(flip).toHaveClass('[transform:rotateY(180deg)]');
  });

  it('keeps a tap target for the card while both faces are present', () => {
    renderSession();

    expect(screen.getByTestId('review-card')).toBeInTheDocument();
  });

  it('shows a pronunciation button to the left of the original word', () => {
    renderSession();
    revealCard();

    const pronunciationButton = screen.getByRole('button', {
      name: 'Play word pronunciation',
    });
    const originalWord = screen.getAllByText('gehen')[1];

    expect(pronunciationButton.compareDocumentPosition(originalWord)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it('adds a card to the current deck without leaving the review session', async () => {
    const onCreateCard = vi.fn().mockResolvedValue(undefined);
    renderSession([card], onCreateCard);

    fireEvent.click(screen.getByRole('button', { name: 'Add a new card' }));
    expect(screen.getByText('Add New Card')).toBeInTheDocument();

    fireEvent.change(
      screen.getByLabelText('Front (Question, term, or prompt)'),
      { target: { value: 'laufen' } },
    );
    fireEvent.change(
      screen.getByLabelText('Back (Answer, definition, or translation)'),
      { target: { value: 'to run' } },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save Card' }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(onCreateCard).toHaveBeenCalledWith({
      front: 'laufen',
      back: 'to run',
    });
    expect(screen.getAllByText('gehen')).not.toHaveLength(0);
  });

  it('aligns dashboard and add-card actions with the outer answer columns', () => {
    renderSession();

    expect(screen.getByTestId('review-answer-area')).toHaveClass(
      'mt-6',
      'min-h-[104px]',
    );
    const footerActions = screen.getByTestId('review-footer-actions');
    expect(footerActions).toHaveClass('grid-cols-3', 'mt-6');
    expect(screen.getByRole('button', { name: 'Back to dashboard' }).parentElement).toHaveClass(
      'col-start-1',
      'justify-start',
    );
    expect(screen.getByRole('button', { name: 'Back to dashboard' })).toHaveClass(
      'size-12',
    );
    expect(screen.getByRole('button', { name: 'Add a new card' }).parentElement).toHaveClass(
      'col-start-3',
      'justify-end',
    );
    expect(screen.getByRole('button', { name: 'Add a new card' })).toHaveClass(
      'rounded-none',
      'size-12',
      'text-black',
    );
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
    ['Struggled', 'ArrowUp'],
    ['Remembered', 'ArrowRight'],
  ])('moves to the next card after %s', (_, key) => {
    renderSession([card, secondCard]);
    revealCard();

    fireEvent.keyDown(window, { key });
    finishCardExit();

    expect(screen.getAllByText('sein')).not.toHaveLength(0);
    expect(screen.getByTestId('review-card-flip')).toHaveAttribute(
      'data-flipped',
      'false',
    );
  });

  it('moves to the next card after using a visible answer button', () => {
    renderSession([card, secondCard]);
    revealCard();

    fireEvent.click(screen.getByRole('button', { name: 'Struggled' }));
    finishCardExit();

    expect(screen.getAllByText('sein')).not.toHaveLength(0);
  });

  it('moves to the next card to the right after Knew it', () => {
    renderSession([card, secondCard]);
    revealCard();

    fireEvent.click(screen.getByRole('button', { name: 'Knew it' }));

    expect(screen.getByTestId('review-card-surface')).toHaveStyle({
      transform: 'translate3d(120vw, 0, 0) rotate(10deg)',
    });

    finishCardExit();
    expect(screen.getAllByText('sein')).not.toHaveLength(0);
  });

  it('shows the matching feedback while dragging the answer side', () => {
    renderSession();
    revealCard();
    const reviewCard = screen.getByTestId('review-card');

    fireEvent.pointerDown(reviewCard, { clientX: 200, clientY: 200 });
    fireEvent.pointerMove(reviewCard, { clientX: 140, clientY: 200 });

    expect(screen.getByTestId('swipe-feedback')).toHaveTextContent('Forgot');
    expect(screen.getByTestId('swipe-feedback')).toHaveClass(
      'text-muted-foreground',
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
      screen.queryByRole('button', { name: 'Open card settings' }),
    ).not.toBeInTheDocument();

    revealCard();

    expect(
      screen.getByRole('button', { name: 'Open card settings' }),
    ).toBeEnabled();
  });

  it('opens the card settings placeholder and closes it', () => {
    renderSession();
    revealCard();

    fireEvent.click(screen.getByRole('button', { name: 'Open card settings' }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Card settings' })).toBeInTheDocument();
    expect(screen.getByRole('dialog').parentElement).toHaveClass(
      'items-center',
      'justify-center',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens word details and returns to the same answer view when closed', () => {
    renderSession();
    revealCard();

    fireEvent.click(screen.getByRole('button', { name: 'Open word details' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('dialog').parentElement).toHaveClass(
      'items-center',
      'justify-center',
    );

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
    finishCardExit();
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByRole('alertdialog').parentElement).toHaveClass(
      'items-center',
      'justify-center',
    );
    expect(
      screen.getByRole('heading', { name: 'Delete “gehen”?' }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Yes' }));
    expect(
      screen.getByRole('heading', { name: 'Deletion is not available yet' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('dialog').parentElement).toHaveClass(
      'items-center',
      'justify-center',
    );
  });

  it('keeps the visible answer buttons without shadows', () => {
    renderSession();
    revealCard();

    expect(screen.getByRole('button', { name: 'Forgot' })).toHaveClass(
      'shadow-none',
    );
    expect(screen.getByRole('button', { name: 'Struggled' })).toHaveClass(
      'shadow-none',
    );
    expect(screen.getByRole('button', { name: 'Remembered' })).toHaveClass(
      'shadow-none',
    );
    expect(screen.getByRole('button', { name: 'Knew it' })).toHaveClass(
      'col-start-2',
      'shadow-none',
    );
    expect(screen.getByTestId('review-answer-area')).toHaveClass('mt-6');
  });

  it('shows the next card while the answered card exits to the chosen side', () => {
    renderSession([card, secondCard]);
    revealCard();

    fireEvent.keyDown(window, { key: 'ArrowLeft' });

    expect(screen.getByTestId('next-review-card')).toHaveTextContent('sein');
    expect(screen.getByTestId('review-card-surface')).toHaveStyle({
      transform: 'translate3d(-120vw, 0, 0) rotate(-10deg)',
    });

    finishCardExit();
    expect(screen.getAllByText('sein')).not.toHaveLength(0);
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
