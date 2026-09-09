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
  note_id: 'note-2',
  front: 'sein',
  back: 'to be',
};

const thirdCard: Card = {
  ...card,
  id: 'card-3',
  note_id: 'note-3',
  front: 'haben',
  back: 'to have',
};

const siblingCard: Card = {
  ...card,
  id: 'card-4',
  template_key: 'word:audio',
  front: 'gehen pronunciation',
  back: 'gehen audio',
};

function renderSession(
  cards: Card[] = [card],
  onCreateCard = vi.fn().mockResolvedValue(undefined),
  onRecordReview = vi.fn().mockResolvedValue({ id: 'review-1' }),
  onDeleteNote = vi.fn().mockResolvedValue(undefined),
  reviewPreferences: {
    reviewMode?: 'basic' | 'extended';
    showNextReviewInterval?: boolean;
  } = {},
) {
  const { reviewMode, showNextReviewInterval } = reviewPreferences;
  const onExit = vi.fn();
  render(
    <ReviewSession
      cards={cards}
      deckTitle="German basics"
      onExit={onExit}
      onCreateCard={onCreateCard}
      onRecordReview={onRecordReview}
      onDeleteNote={onDeleteNote}
      reviewMode={reviewMode ?? 'extended'}
      showNextReviewInterval={showNextReviewInterval}
    />,
  );
  return { onCreateCard, onExit, onRecordReview, onDeleteNote };
}

function revealCard() {
  fireEvent.click(screen.getByTestId('review-card'));
}

function finishCardExit() {
  act(() => {
    vi.runOnlyPendingTimers();
  });
}

function finishCardFlip() {
  act(() => {
    vi.advanceTimersByTime(300);
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

  it('renders Markdown on the current card, answer, and next-card preview', () => {
    renderSession([
      {
        ...card,
        front: '**gehen**',
        back: '*to go*\n\n- ich gehe\n- du gehst',
      },
      { ...secondCard, front: '## sein' },
    ]);

    expect(
      screen.getAllByText('gehen').map((element) => element.tagName),
    ).toEqual(['STRONG', 'STRONG']);
    expect(screen.getByText('sein').tagName).toBe('H2');

    revealCard();

    expect(screen.getByText('to go').tagName).toBe('EM');
    expect(screen.getByRole('list')).toBeInTheDocument();
  });

  it('keeps long review Markdown inside the card bounds', () => {
    renderSession([
      {
        ...card,
        front: 'A very long question '.repeat(200),
        back: 'A very long answer '.repeat(200),
      },
    ]);

    const frontContent = screen.getByTestId('review-card-front-content');
    expect(frontContent).toHaveClass('max-h-full', 'overflow-hidden');

    revealCard();

    const backContent = screen.getByTestId('review-card-back-content');
    expect(backContent).toHaveClass('max-h-full', 'overflow-hidden');
  });

  it('shows the current deck title above the review card', () => {
    renderSession();

    expect(
      screen.getByRole('heading', { name: 'German basics' }),
    ).toBeInTheDocument();
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
    expect(screen.getByTestId('review-card')).toHaveClass(
      'touch-none',
      'select-none',
      'z-20',
    );
  });

  it('does not show unavailable word-only controls', () => {
    renderSession();
    revealCard();

    expect(
      screen.queryByRole('button', { name: 'Play word pronunciation' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Open word details' }),
    ).not.toBeInTheDocument();
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

  it.each([
    ['front', false],
    ['back', true],
  ])(
    'allows typing a multi-word card without triggering review shortcuts on the %s side',
    (_, revealAnswerFirst) => {
      const { onRecordReview } = renderSession([card, secondCard]);
      if (revealAnswerFirst) revealCard();

      fireEvent.click(screen.getByRole('button', { name: 'Add a new card' }));
      const frontInput = screen.getByLabelText(
        'Front (Question, term, or prompt)',
      );
      const spaceEvent = new KeyboardEvent('keydown', {
        bubbles: true,
        cancelable: true,
        code: 'Space',
        key: ' ',
      });

      frontInput.dispatchEvent(spaceEvent);
      fireEvent.change(frontInput, { target: { value: 'two words' } });
      fireEvent.keyDown(frontInput, { key: 'ArrowRight' });

      expect(spaceEvent.defaultPrevented).toBe(false);
      expect(frontInput).toHaveValue('two words');
      expect(onRecordReview).not.toHaveBeenCalled();
      expect(screen.getByTestId('review-card-flip')).toHaveAttribute(
        'data-flipped',
        String(revealAnswerFirst),
      );
    },
  );

  it('keeps the review answer area stable and aligns footer actions with its outer columns', () => {
    renderSession();

    expect(screen.getByTestId('review-front-answer-buttons')).toHaveTextContent(
      'Show answer',
    );
    expect(screen.getByTestId('review-card-flip')).toHaveClass(
      'min-h-[min(52dvh,28rem)]',
    );
    expect(screen.getByTestId('review-answer-area')).toHaveClass(
      'mt-6',
      'min-h-[104px]',
    );
    const footerActions = screen.getByTestId('review-footer-actions');
    expect(footerActions).toHaveClass('grid-cols-3', 'mt-6');
    expect(
      screen.getByRole('button', { name: 'Back to dashboard' }).parentElement,
    ).toHaveClass('col-start-1', 'justify-start');
    expect(
      screen.getByRole('button', { name: 'Back to dashboard' }),
    ).toHaveClass('size-12');
    expect(
      screen.getByRole('button', { name: 'Add a new card' }).parentElement,
    ).toHaveClass('col-start-3', 'justify-end');
    expect(screen.getByRole('button', { name: 'Add a new card' })).toHaveClass(
      'rounded-none',
      'size-12',
      'text-black',
    );
  });

  it.each([
    ' ',
    '1',
    '2',
    '3',
    '4',
    'ArrowLeft',
    'ArrowRight',
    'ArrowUp',
    'ArrowDown',
  ])('reveals the answer with %s on the card front', (key) => {
    renderSession();

    fireEvent.keyDown(window, { key, code: key === ' ' ? 'Space' : key });
    expect(screen.getByText('to go')).toBeInTheDocument();
  });

  it('uses Show answer only to reveal the answer', () => {
    renderSession();

    const showAnswerButton = screen.getByRole('button', {
      name: 'Show answer',
    });
    expect(showAnswerButton).toHaveClass('bg-muted/40', 'shadow-none');

    fireEvent.click(showAnswerButton);

    expect(screen.getByTestId('review-card-flip')).toHaveAttribute(
      'data-flipped',
      'true',
    );
    expect(screen.getByText('to go')).toBeInTheDocument();
  });

  it('moves keyboard focus to the first visible answer after revealing', () => {
    renderSession();
    const reviewCard = screen.getByTestId('review-card');
    reviewCard.focus();

    fireEvent.keyDown(window, { key: 'ArrowRight' });

    expect(screen.getByRole('button', { name: 'Again' })).toHaveFocus();
    expect(reviewCard).toHaveAttribute('tabindex', '-1');
  });

  it('accepts an arrow-key answer when a visible answer button has focus', async () => {
    const onRecordReview = vi.fn().mockResolvedValue({ id: 'review-1' });
    renderSession([card, secondCard], undefined, onRecordReview);
    revealCard();

    const againButton = screen.getByRole('button', { name: 'Again' });
    expect(againButton).toHaveFocus();

    fireEvent.keyDown(againButton, { key: 'ArrowRight' });
    await act(async () => {
      await Promise.resolve();
    });

    expect(onRecordReview).toHaveBeenCalledWith('card-1', 3);
  });

  it.each([
    [1, '1'],
    [2, '2'],
    [3, '3'],
    [4, '4'],
  ])(
    'records Extended rating %s with keyboard shortcut %s',
    async (rating, key) => {
      const onRecordReview = vi.fn().mockResolvedValue({ id: 'review-1' });
      renderSession([card, secondCard], undefined, onRecordReview);
      revealCard();

      fireEvent.keyDown(window, { key });
      await act(async () => {
        await Promise.resolve();
      });

      expect(onRecordReview).toHaveBeenCalledWith('card-1', rating);
    },
  );

  it.each([
    [1, '1'],
    [3, '2'],
  ])(
    'records Basic rating %s with keyboard shortcut %s',
    async (rating, key) => {
      const onRecordReview = vi.fn().mockResolvedValue({ id: 'review-1' });
      renderSession([card, secondCard], undefined, onRecordReview, undefined, {
        reviewMode: 'basic',
      });
      revealCard();

      fireEvent.keyDown(window, { key });
      await act(async () => {
        await Promise.resolve();
      });

      expect(onRecordReview).toHaveBeenCalledWith('card-1', rating);
    },
  );

  it.each(['keyboard', 'swipe'] as const)(
    'does not record a rating when %s reveals the answer',
    (interaction) => {
      const onRecordReview = vi.fn().mockResolvedValue({ id: 'review-1' });
      renderSession([card], undefined, onRecordReview);

      if (interaction === 'keyboard') {
        fireEvent.keyDown(window, { key: 'ArrowRight' });
      } else {
        fireEvent.pointerDown(screen.getByTestId('review-card'), {
          clientX: 200,
          clientY: 200,
        });
      }

      expect(screen.getByTestId('review-card-flip')).toHaveAttribute(
        'data-flipped',
        'true',
      );
      expect(onRecordReview).not.toHaveBeenCalled();
    },
  );

  it('shows two existing Basic ratings after revealing the answer', () => {
    renderSession([card], undefined, undefined, undefined, {
      reviewMode: 'basic',
    });

    expect(screen.getByRole('button', { name: 'Show answer' })).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Forgot' }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show answer' }));

    expect(screen.getByRole('button', { name: 'Forgot' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Remembered' })).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Struggled' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Knew it' }),
    ).not.toBeInTheDocument();
  });

  it('shows scheduler intervals for the same existing ratings used by Basic and Extended', () => {
    renderSession(
      [{ ...card, scheduled_interval_minutes: 3 * 24 * 60 }],
      undefined,
      undefined,
      undefined,
      { reviewMode: 'basic', showNextReviewInterval: true },
    );

    fireEvent.click(screen.getByRole('button', { name: 'Show answer' }));

    expect(screen.getByRole('button', { name: /Forgot.*5 min/ })).toBeVisible();
    expect(
      screen.getByRole('button', { name: /Remembered.*8 days/ }),
    ).toBeVisible();
  });

  it('shows all Extended intervals from the existing scheduler ratings', () => {
    renderSession(
      [{ ...card, scheduled_interval_minutes: 3 * 24 * 60 }],
      undefined,
      undefined,
      undefined,
      { reviewMode: 'extended', showNextReviewInterval: true },
    );

    fireEvent.click(screen.getByRole('button', { name: 'Show answer' }));

    expect(screen.getByRole('button', { name: /Again.*5 min/ })).toBeVisible();
    expect(screen.getByRole('button', { name: /Hard.*4 days/ })).toBeVisible();
    expect(screen.getByRole('button', { name: /Good.*8 days/ })).toBeVisible();
    expect(screen.getByRole('button', { name: /Easy.*10 days/ })).toBeVisible();
  });

  it('keeps four Extended buttons in one grid row when intervals are shown', () => {
    renderSession(
      [{ ...card, scheduled_interval_minutes: 3 * 24 * 60 }],
      undefined,
      undefined,
      undefined,
      { reviewMode: 'extended', showNextReviewInterval: true },
    );

    fireEvent.click(screen.getByRole('button', { name: 'Show answer' }));

    const answerGrid = screen.getByRole('button', {
      name: /Again.*5 min/,
    }).parentElement;
    expect(answerGrid).toHaveClass('grid-cols-4');
    expect(screen.getByRole('button', { name: /Again.*5 min/ })).toHaveClass(
      'min-w-0',
    );
  });

  it.each([
    ['Again', /Again.*5 min/, 1],
    ['Hard', /Hard.*4 days/, 2],
    ['Good', /Good.*8 days/, 3],
    ['Easy', /Easy.*10 days/, 4],
  ])(
    'maps the Extended %s button to its existing rating and interval',
    async (label, accessibleName, expectedRating) => {
      const onRecordReview = vi.fn().mockResolvedValue({ id: 'review-1' });
      renderSession(
        [{ ...card, scheduled_interval_minutes: 3 * 24 * 60 }],
        undefined,
        onRecordReview,
        undefined,
        { reviewMode: 'extended', showNextReviewInterval: true },
      );

      fireEvent.click(screen.getByRole('button', { name: 'Show answer' }));
      fireEvent.click(screen.getByRole('button', { name: accessibleName }));

      await act(async () => {
        await Promise.resolve();
      });

      expect(onRecordReview).toHaveBeenCalledWith('card-1', expectedRating);
      expect(
        screen.getByRole('button', { name: accessibleName }),
      ).toHaveTextContent(label);
    },
  );

  it('keeps the hidden card control out of Tab navigation after revealing the answer', () => {
    renderSession();

    const cardControl = screen.getByTestId('review-card');
    expect(cardControl).toHaveAttribute('tabindex', '0');

    fireEvent.click(screen.getByRole('button', { name: 'Show answer' }));

    expect(cardControl).toHaveAttribute('tabindex', '-1');
  });

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

  it('turns the card over without moving it or showing feedback on the front', () => {
    renderSession();
    const reviewCard = screen.getByTestId('review-card');

    fireEvent.pointerDown(reviewCard, { clientX: 200, clientY: 200 });
    fireEvent.pointerMove(reviewCard, { clientX: 320, clientY: 200 });

    expect(screen.queryByTestId('swipe-feedback')).not.toBeInTheDocument();
    expect(screen.getByTestId('review-card-surface')).toHaveStyle({
      transform: 'translate3d(0px, 0px, 0) rotate(0deg)',
    });
  });

  it.each([
    ['Forgot', 'ArrowLeft'],
    ['Struggled', 'ArrowUp'],
    ['Remembered', 'ArrowRight'],
  ])('moves to the next card after %s', async (_, key) => {
    renderSession([card, secondCard]);
    revealCard();

    fireEvent.keyDown(window, { key });
    await act(async () => {
      await Promise.resolve();
    });
    finishCardExit();

    expect(screen.getByTestId('review-card-surface')).toHaveAttribute(
      'data-card-id',
      'card-2',
    );
    expect(screen.getByTestId('review-card-flip')).toHaveAttribute(
      'data-flipped',
      'false',
    );
  });

  it('persists the rating before moving to the next card from a visible answer button', async () => {
    const onRecordReview = vi.fn().mockResolvedValue(undefined);
    renderSession([card, secondCard], undefined, onRecordReview);
    revealCard();

    fireEvent.click(screen.getByRole('button', { name: 'Hard' }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(onRecordReview).toHaveBeenCalledWith('card-1', 2);
    finishCardExit();

    expect(screen.getByTestId('review-card-surface')).toHaveAttribute(
      'data-card-id',
      'card-2',
    );
  });

  it('keeps the card in place and shows a recoverable error when saving fails', async () => {
    const onRecordReview = vi.fn().mockRejectedValue(new Error('write failed'));
    renderSession([card, secondCard], undefined, onRecordReview);
    revealCard();

    fireEvent.click(screen.getByRole('button', { name: 'Good' }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(onRecordReview).toHaveBeenCalledWith('card-1', 3);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Could not save your answer. Try again.',
    );
    expect(screen.getByTestId('review-card-surface')).toHaveAttribute(
      'data-card-id',
      'card-1',
    );
  });

  it('disables review answers while a save is in progress', async () => {
    let completeReview: (() => void) | undefined;
    const onRecordReview = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          completeReview = resolve;
        }),
    );
    renderSession([card, secondCard], undefined, onRecordReview);
    revealCard();

    fireEvent.click(screen.getByRole('button', { name: 'Again' }));

    expect(screen.getByRole('button', { name: 'Again' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Hard' })).toBeDisabled();
    expect(onRecordReview).toHaveBeenCalledTimes(1);

    await act(async () => {
      completeReview?.();
      await Promise.resolve();
    });

    finishCardExit();
    expect(screen.getByTestId('review-card-surface')).toHaveAttribute(
      'data-card-id',
      'card-2',
    );
  });

  it('does not show an unavailable Undo control after an answer', async () => {
    const onRecordReview = vi.fn().mockResolvedValue({ id: 'review-42' });
    renderSession([card, secondCard], undefined, onRecordReview);
    revealCard();

    fireEvent.click(screen.getByRole('button', { name: 'Good' }));
    await act(async () => {
      await Promise.resolve();
    });
    finishCardExit();

    expect(
      screen.queryByRole('button', { name: 'Undo' }),
    ).not.toBeInTheDocument();
  });

  it('moves to the next card to the right after Easy', async () => {
    renderSession([card, secondCard]);
    revealCard();

    fireEvent.click(screen.getByRole('button', { name: 'Easy' }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByTestId('review-card-surface')).toHaveStyle({
      transform: 'translate3d(120vw, 0, 0) rotate(10deg)',
    });

    finishCardExit();
    expect(screen.getByTestId('review-card-surface')).toHaveAttribute(
      'data-card-id',
      'card-2',
    );
  });

  it('loads a new batch after the current batch is completed', async () => {
    const onRequestNextBatch = vi.fn(() => [secondCard]);
    render(
      <ReviewSession
        cards={[card]}
        deckTitle="German basics"
        onExit={vi.fn()}
        onCreateCard={vi.fn().mockResolvedValue(undefined)}
        onRecordReview={vi.fn().mockResolvedValue({ id: 'review-1' })}
        onDeleteNote={vi.fn().mockResolvedValue(undefined)}
        onRequestNextBatch={onRequestNextBatch}
        reviewMode="extended"
      />,
    );

    revealCard();
    fireEvent.click(screen.getByRole('button', { name: 'Good' }));
    await act(async () => {
      await Promise.resolve();
    });
    finishCardExit();

    expect(onRequestNextBatch).toHaveBeenCalledOnce();
    expect(screen.getByTestId('review-card-surface')).toHaveAttribute(
      'data-card-id',
      'card-2',
    );
  });

  it('shows the matching feedback while dragging the answer side', () => {
    renderSession();
    revealCard();
    const reviewCard = screen.getByTestId('review-card');

    fireEvent.pointerDown(reviewCard, { clientX: 200, clientY: 200 });
    fireEvent.pointerMove(reviewCard, { clientX: 140, clientY: 200 });

    expect(screen.getByTestId('swipe-feedback')).toHaveTextContent('Again');
    expect(screen.getByTestId('swipe-feedback')).toHaveClass(
      'text-muted-foreground',
      'z-30',
    );
    expect(screen.getByTestId('review-card-surface')).toHaveStyle({
      transform: 'translate3d(-60px, 0px, 0) rotate(-2.5deg)',
    });

    fireEvent.pointerCancel(reviewCard);
    expect(screen.getByTestId('swipe-feedback')).toHaveTextContent('Again');
    expect(screen.getByTestId('review-card-surface')).toHaveStyle({
      transform: 'translate3d(0px, 0px, 0) rotate(0deg)',
    });

    fireEvent.transitionEnd(screen.getByTestId('review-card-surface'));
    expect(screen.queryByTestId('swipe-feedback')).not.toBeInTheDocument();
  });

  it('keeps swipe feedback visible while the answered card exits', async () => {
    renderSession([card, secondCard]);
    revealCard();
    const reviewCard = screen.getByTestId('review-card');

    fireEvent.pointerDown(reviewCard, { clientX: 200, clientY: 200 });
    fireEvent.pointerMove(reviewCard, { clientX: 140, clientY: 200 });
    fireEvent.pointerUp(reviewCard, { clientX: 100, clientY: 200 });

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByTestId('swipe-feedback')).toHaveTextContent('Again');
    expect(screen.getByTestId('review-card-surface')).toHaveStyle({
      transform: 'translate3d(-120vw, 0, 0) rotate(-10deg)',
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

  it('changes the feedback immediately when one swipe changes direction', () => {
    renderSession();
    revealCard();
    const reviewCard = screen.getByTestId('review-card');
    const cardSurface = screen.getByTestId('review-card-surface');

    fireEvent.pointerDown(reviewCard, { clientX: 200, clientY: 200 });
    fireEvent.pointerMove(reviewCard, { clientX: 140, clientY: 200 });
    expect(cardSurface).toHaveStyle({
      transform: 'translate3d(-60px, 0px, 0) rotate(-2.5deg)',
    });
    expect(screen.getByTestId('swipe-feedback')).toHaveTextContent('Again');

    fireEvent.pointerMove(reviewCard, { clientX: 200, clientY: 200 });
    expect(screen.queryByTestId('swipe-feedback')).not.toBeInTheDocument();
    expect(cardSurface).toHaveStyle({
      transform: 'translate3d(0px, 0px, 0) rotate(0deg)',
    });

    fireEvent.pointerMove(reviewCard, { clientX: 260, clientY: 200 });
    expect(screen.getByTestId('swipe-feedback')).toHaveTextContent('Good');
    expect(cardSurface).toHaveStyle({
      transform: 'translate3d(60px, 0px, 0) rotate(2.5deg)',
    });
  });

  it('clears swipe feedback when an unsupported Basic swipe moves upward', () => {
    renderSession([card], undefined, undefined, undefined, {
      reviewMode: 'basic',
    });
    revealCard();
    const reviewCard = screen.getByTestId('review-card');

    fireEvent.pointerDown(reviewCard, { clientX: 200, clientY: 200 });
    fireEvent.pointerMove(reviewCard, { clientX: 260, clientY: 200 });
    expect(screen.getByTestId('swipe-feedback')).toHaveTextContent(
      'Remembered',
    );

    fireEvent.pointerMove(reviewCard, { clientX: 200, clientY: 140 });
    expect(screen.queryByTestId('swipe-feedback')).not.toBeInTheDocument();
  });

  it('turns the front side over as soon as it is touched', () => {
    renderSession();

    fireEvent.pointerDown(screen.getByTestId('review-card'), {
      clientX: 200,
      clientY: 200,
    });

    expect(screen.getByTestId('review-card-flip')).toHaveAttribute(
      'data-flipped',
      'true',
    );
  });

  it('does not render an unavailable card-settings control', () => {
    renderSession();
    revealCard();
    finishCardFlip();

    expect(
      screen.queryByRole('button', { name: 'Open card settings' }),
    ).not.toBeInTheDocument();
  });

  it('does not render an unavailable word-details control', () => {
    renderSession();
    revealCard();
    finishCardFlip();

    expect(
      screen.queryByRole('button', { name: 'Open word details' }),
    ).not.toBeInTheDocument();
  });

  it('keeps review keyboard controls inactive while delete confirmation is open', () => {
    const onRecordReview = vi.fn().mockResolvedValue({ id: 'review-1' });
    renderSession([card], undefined, onRecordReview);
    revealCard();

    fireEvent.keyDown(window, { key: 'ArrowDown' });
    finishCardExit();

    const cancelButton = screen.getByRole('button', { name: 'No' });
    expect(cancelButton).toHaveFocus();

    fireEvent.keyDown(cancelButton, { key: 'ArrowRight' });
    expect(onRecordReview).not.toHaveBeenCalled();
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });

  it('cycles keyboard focus between delete confirmation buttons', () => {
    renderSession();
    revealCard();

    fireEvent.keyDown(window, { key: 'ArrowDown' });
    finishCardExit();

    const cancelButton = screen.getByRole('button', { name: 'No' });
    const confirmButton = screen.getByRole('button', { name: 'Yes' });

    fireEvent.keyDown(cancelButton, { key: 'Tab' });
    expect(confirmButton).toHaveFocus();

    fireEvent.keyDown(confirmButton, { key: 'Tab' });
    expect(cancelButton).toHaveFocus();

    fireEvent.keyDown(cancelButton, { key: 'Tab', shiftKey: true });
    expect(confirmButton).toHaveFocus();
  });

  it('cancels delete confirmation with Escape and restores card focus', () => {
    const onRecordReview = vi.fn().mockResolvedValue({ id: 'review-1' });
    renderSession([card], undefined, onRecordReview);
    revealCard();

    fireEvent.keyDown(window, { key: 'ArrowDown' });
    finishCardExit();

    fireEvent.keyDown(screen.getByRole('button', { name: 'No' }), {
      key: 'Escape',
    });

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByTestId('review-card')).toHaveFocus();

    fireEvent.keyDown(screen.getByTestId('review-card'), {
      key: 'ArrowRight',
    });
    expect(onRecordReview).toHaveBeenCalledWith('card-1', 3);
  });

  it('removes every sibling from the session queue after deleting a note', async () => {
    const onDeleteNote = vi.fn().mockResolvedValue(undefined);
    renderSession(
      [card, siblingCard, secondCard],
      undefined,
      undefined,
      onDeleteNote,
    );
    revealCard();

    fireEvent.keyDown(window, { key: 'ArrowDown' });
    finishCardExit();
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByRole('alertdialog').parentElement).toHaveClass(
      'items-center',
      'justify-center',
    );
    expect(
      screen.getByRole('heading', {
        name: 'Does permanently delete this word?',
      }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Yes' }));
    await act(async () => {
      await Promise.resolve();
    });

    expect(onDeleteNote).toHaveBeenCalledWith('note-1');
    expect(screen.getByTestId('review-card-surface')).toHaveAttribute(
      'data-card-id',
      'card-2',
    );
    expect(screen.queryByText('gehen pronunciation')).not.toBeInTheDocument();
  });

  it('completes the session when deleting a note removes the remaining cards', async () => {
    renderSession([card, siblingCard]);
    revealCard();

    fireEvent.keyDown(window, { key: 'ArrowDown' });
    finishCardExit();
    fireEvent.click(screen.getByRole('button', { name: 'Yes' }));
    await act(async () => {
      await Promise.resolve();
    });

    expect(
      screen.getByRole('heading', { name: 'Review complete' }),
    ).toBeInTheDocument();
  });

  it('keeps the delete confirmation open when deleting the note fails', async () => {
    const onDeleteNote = vi.fn().mockRejectedValue(new Error('write failed'));
    renderSession([card], undefined, undefined, onDeleteNote);
    revealCard();

    fireEvent.keyDown(window, { key: 'ArrowDown' });
    finishCardExit();
    fireEvent.click(screen.getByRole('button', { name: 'Yes' }));
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Could not delete this word. Try again.',
    );
    expect(screen.getByRole('button', { name: 'Yes' })).toBeEnabled();
  });

  it('keeps the visible answer buttons without shadows', () => {
    renderSession();
    revealCard();

    expect(screen.getByRole('button', { name: 'Again' })).toHaveClass(
      'shadow-none',
    );
    expect(screen.getByRole('button', { name: 'Hard' })).toHaveClass(
      'shadow-none',
    );
    expect(screen.getByRole('button', { name: 'Good' })).toHaveClass(
      'shadow-none',
    );
    expect(screen.getByRole('button', { name: 'Easy' })).toHaveClass(
      'shadow-none',
    );
    expect(screen.getByTestId('review-answer-area')).toHaveClass('mt-6');
  });

  it('shows the next card while the answered card exits to the chosen side', async () => {
    renderSession([card, secondCard, thirdCard]);
    revealCard();

    fireEvent.keyDown(window, { key: 'ArrowLeft' });

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByTestId('next-review-card')).toHaveTextContent('sein');
    expect(screen.getByTestId('next-review-card')).toHaveClass('top-0', 'z-1');
    expect(screen.getByTestId('following-review-card-outline')).toHaveClass(
      'top-3',
      'z-0',
    );
    expect(screen.getByTestId('review-card-surface')).toHaveStyle({
      transform: 'translate3d(-120vw, 0, 0) rotate(-10deg)',
    });

    finishCardExit();
    expect(screen.getAllByText('sein')).not.toHaveLength(0);
    expect(screen.getByTestId('review-card-surface')).toHaveAttribute(
      'data-card-id',
      'card-2',
    );
  });

  it('does not show a lower outline beneath the final review card', () => {
    renderSession([card, secondCard]);

    expect(
      screen.queryByTestId('following-review-card-outline'),
    ).not.toBeInTheDocument();
  });

  it('returns to the dashboard', () => {
    const { onExit } = renderSession();

    fireEvent.click(screen.getByRole('button', { name: 'Back to dashboard' }));
    expect(onExit).toHaveBeenCalledOnce();
  });

  it('shows the completed-session state when the session has no cards', () => {
    renderSession([]);

    expect(
      screen.getByRole('heading', { name: 'Review complete' }),
    ).toBeInTheDocument();
  });
});
