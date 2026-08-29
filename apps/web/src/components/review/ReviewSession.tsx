import { Button } from '@/components/ui/button';
import { PageContainer } from '@/components/PageContainer';
import { Card } from '@/hooks/useStore';
import {
  ArrowLeft,
  BookOpen,
  Cog,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  CURRENT_REVIEW_MODE,
  getAnswerForReviewGesture,
  type ReviewAnswer,
  type ReviewMode,
} from './review-controls';

type SwipeDirection = Exclude<ReviewAnswer, 'very-easy'> | 'delete';

type ReviewSessionProps = {
  cards: Card[];
  onExit: () => void;
  reviewMode?: ReviewMode;
};

const SWIPE_THRESHOLD_PX = 48;
const SWIPE_FEEDBACK_THRESHOLD_PX = 1;
const MAX_DRAG_DISTANCE_X_PX = 96;
const MAX_DRAG_DISTANCE_Y_PX = 72;
const MAX_DRAG_ROTATION_DEG = 4;
const REVIEW_CARD_EXIT_DURATION_MS = 250;

const exitTransformByDirection: Record<SwipeDirection, string> = {
  forgot: 'translate3d(-120vw, 0, 0) rotate(-10deg)',
  remember: 'translate3d(120vw, 0, 0) rotate(10deg)',
  hard: 'translate3d(0, -120dvh, 0) rotate(0deg)',
  delete: 'translate3d(0, 120dvh, 0) rotate(0deg)',
};

const swipeFeedback: Record<SwipeDirection, { label: string; className: string }> = {
  forgot: {
    label: 'Forgot',
    className: 'right-5 top-5 text-right text-muted-foreground',
  },
  remember: {
    label: 'Remember',
    className:
      'left-5 top-5 text-emerald-700 dark:text-emerald-400',
  },
  hard: {
    label: 'Hard',
    className:
      'bottom-5 left-1/2 -translate-x-1/2 text-amber-700 dark:text-amber-400',
  },
  delete: {
    label: 'Delete word',
    className: 'left-1/2 top-5 -translate-x-1/2 text-destructive',
  },
};

export function ReviewSession({
  cards,
  onExit,
  reviewMode = CURRENT_REVIEW_MODE,
}: ReviewSessionProps) {
  const [sessionCards] = useState(cards);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isWordDetailsOpen, setIsWordDetailsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDeleteConfirmationOpen, setIsDeleteConfirmationOpen] = useState(false);
  const [isDeletePlaceholderOpen, setIsDeletePlaceholderOpen] = useState(false);
  const [dragDirection, setDragDirection] = useState<SwipeDirection | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isRecentering, setIsRecentering] = useState(false);
  const [exitDirection, setExitDirection] = useState<SwipeDirection | null>(
    null,
  );
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const pendingPointerPosition = useRef<{ x: number; y: number } | null>(
    null,
  );
  const activeDragDirection = useRef<SwipeDirection | null>(null);
  const exitTimer = useRef<number | null>(null);
  const didHandleSwipe = useRef(false);
  const card = sessionCards[currentCardIndex];
  const nextCard = sessionCards[currentCardIndex + 1];

  const revealAnswer = () => setIsFlipped(true);
  const openWordDetails = () => setIsWordDetailsOpen(true);
  const openSettings = () => setIsSettingsOpen(true);

  const restoreCurrentCard = () => {
    setExitDirection(null);
    setIsDeleteConfirmationOpen(false);
    setIsDeletePlaceholderOpen(false);
  };

  const startCardExit = (direction: SwipeDirection) => {
    if (exitDirection) return;

    setDragDirection(null);
    setDragOffset({ x: 0, y: 0 });
    setIsDragging(false);
    setIsRecentering(false);
    setExitDirection(direction);
    exitTimer.current = window.setTimeout(() => {
      if (direction === 'delete') {
        setIsDeleteConfirmationOpen(true);
        return;
      }

      setIsWordDetailsOpen(false);
      setIsFlipped(false);
      setCurrentCardIndex((index) => index + 1);
      setExitDirection(null);
    }, REVIEW_CARD_EXIT_DURATION_MS);
  };

  const answerCard = (answer: ReviewAnswer) => {
    // The next step will persist this answer and update due_at before advance.
    void answer;
    const directionByAnswer: Record<
      Exclude<ReviewAnswer, 'very-easy'>,
      SwipeDirection
    > = {
      forgot: 'forgot',
      hard: 'hard',
      remember: 'remember',
    };

    if (answer !== 'very-easy') startCardExit(directionByAnswer[answer]);
  };

  useEffect(() => {
    return () => {
      if (exitTimer.current) window.clearTimeout(exitTimer.current);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isSettingsOpen) {
        if (event.key === 'Escape') {
          event.preventDefault();
          setIsSettingsOpen(false);
        }
        return;
      }

      if (isWordDetailsOpen) {
        if (event.key === 'Escape') {
          event.preventDefault();
          setIsWordDetailsOpen(false);
        } else if (event.key === 'ArrowRight') {
          event.preventDefault();
          const answer = getAnswerForReviewGesture(reviewMode, 'right');
          if (answer) answerCard(answer);
        } else if (event.key === 'ArrowLeft') {
          event.preventDefault();
          const answer = getAnswerForReviewGesture(reviewMode, 'left');
          if (answer) answerCard(answer);
        } else if (event.key === 'ArrowUp') {
          event.preventDefault();
          const answer = getAnswerForReviewGesture(reviewMode, 'up');
          if (answer) answerCard(answer);
        }
        return;
      }

      if (!isFlipped) {
        if (
          event.code === 'Space' ||
          event.key === 'ArrowLeft' ||
          event.key === 'ArrowRight' ||
          event.key === 'ArrowUp' ||
          event.key === 'ArrowDown'
        ) {
          event.preventDefault();
          revealAnswer();
        }
        return;
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        const answer = getAnswerForReviewGesture(reviewMode, 'right');
        if (answer) answerCard(answer);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        const answer = getAnswerForReviewGesture(reviewMode, 'left');
        if (answer) answerCard(answer);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        const answer = getAnswerForReviewGesture(reviewMode, 'up');
        if (answer) answerCard(answer);
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        startCardExit('delete');
      } else if (event.code === 'Space') {
        event.preventDefault();
        openWordDetails();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [exitDirection, isFlipped, isSettingsOpen, isWordDetailsOpen, reviewMode]);

  const getSwipeDirection = (
    horizontalDistance: number,
    verticalDistance: number,
    threshold: number,
  ): SwipeDirection | null => {
    if (
      Math.max(Math.abs(horizontalDistance), Math.abs(verticalDistance)) <
      threshold
    ) {
      return null;
    }

    if (Math.abs(horizontalDistance) >= Math.abs(verticalDistance)) {
      return getAnswerForReviewGesture(
        reviewMode,
        horizontalDistance > 0 ? 'right' : 'left',
      );
    }

    return verticalDistance < 0
      ? getAnswerForReviewGesture(reviewMode, 'up')
      : 'delete';
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (exitDirection) return;

    event.currentTarget.setPointerCapture?.(event.pointerId);
    pointerStart.current = { x: event.clientX, y: event.clientY };
    pendingPointerPosition.current = null;
    activeDragDirection.current = null;
    didHandleSwipe.current = false;
    setDragDirection(null);
    setDragOffset({ x: 0, y: 0 });
    setIsRecentering(false);
    setIsDragging(isFlipped);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (exitDirection || !isFlipped || !pointerStart.current) return;

    if (isRecentering) {
      pendingPointerPosition.current = {
        x: event.clientX,
        y: event.clientY,
      };
      return;
    }

    const horizontalDistance = event.clientX - pointerStart.current.x;
    const verticalDistance = event.clientY - pointerStart.current.y;
    const isHorizontalDrag =
      Math.abs(horizontalDistance) >= Math.abs(verticalDistance);
    const nextDirection = getSwipeDirection(
      horizontalDistance,
      verticalDistance,
      SWIPE_FEEDBACK_THRESHOLD_PX,
    );

    if (
      activeDragDirection.current &&
      nextDirection &&
      activeDragDirection.current !== nextDirection
    ) {
      pointerStart.current = { x: event.clientX, y: event.clientY };
      pendingPointerPosition.current = pointerStart.current;
      activeDragDirection.current = null;
      setDragDirection(null);
      setDragOffset({ x: 0, y: 0 });
      setIsDragging(false);
      setIsRecentering(true);
      return;
    }

    if (nextDirection) activeDragDirection.current = nextDirection;

    setDragOffset({
      x: isHorizontalDrag
        ? Math.max(
            -MAX_DRAG_DISTANCE_X_PX,
            Math.min(MAX_DRAG_DISTANCE_X_PX, horizontalDistance),
          )
        : 0,
      y: isHorizontalDrag
        ? 0
        : Math.max(
            -MAX_DRAG_DISTANCE_Y_PX,
            Math.min(MAX_DRAG_DISTANCE_Y_PX, verticalDistance),
          ),
    });

    setDragDirection(nextDirection);
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (exitDirection) return;

    const start = pointerStart.current;
    pointerStart.current = null;
    pendingPointerPosition.current = null;
    activeDragDirection.current = null;
    setDragDirection(null);
    setDragOffset({ x: 0, y: 0 });
    setIsRecentering(false);
    setIsDragging(false);
    if (!start) return;

    const direction = getSwipeDirection(
      event.clientX - start.x,
      event.clientY - start.y,
      SWIPE_THRESHOLD_PX,
    );
    if (!direction) return;

    didHandleSwipe.current = true;
    if (!isFlipped) {
      revealAnswer();
    } else if (direction === 'delete') {
      startCardExit('delete');
    } else {
      answerCard(direction);
    }
  };

  if (!card) {
    return <ReviewComplete onExit={onExit} />;
  }

  return (
    <PageContainer className="max-w-3xl py-4 sm:py-6">
      <div className="flex flex-col items-stretch">
        <div className="relative z-10 w-full sm:max-w-xl sm:self-center">
          {nextCard && (
            <div
              className="pointer-events-none absolute inset-x-0 top-3 z-0 flex min-h-[min(52dvh,28rem)] w-full items-center justify-center rounded-3xl border border-border/80 bg-linear-to-br from-white to-zinc-100 p-5 text-center shadow-xl sm:min-h-80 sm:p-8 dark:from-zinc-800 dark:to-zinc-900"
              data-testid="next-review-card"
              aria-hidden="true"
            >
              <span className="max-h-[42svh] overflow-y-auto text-3xl font-bold wrap-break-word sm:max-h-56">
                {nextCard.front}
              </span>
            </div>
          )}
          <div
            className={`relative z-10 ${isDragging ? '' : 'transition-[transform,opacity] duration-[250ms] ease-out'} ${exitDirection ? 'opacity-0' : ''}`}
            style={
              exitDirection
                ? { transform: exitTransformByDirection[exitDirection] }
                : isFlipped
                ? {
                    transform: `translate3d(${dragOffset.x}px, ${dragOffset.y}px, 0) rotate(${(dragOffset.x / MAX_DRAG_DISTANCE_X_PX) * MAX_DRAG_ROTATION_DEG}deg)`,
                  }
                : undefined
            }
            data-testid="review-card-surface"
            onTransitionEnd={(event) => {
              if (event.target !== event.currentTarget || !isRecentering) return;

              pointerStart.current = pendingPointerPosition.current;
              setIsRecentering(false);
              setIsDragging(true);
            }}
          >
            <button
              type="button"
              onClick={() => {
                if (exitDirection) return;
                if (didHandleSwipe.current) {
                  didHandleSwipe.current = false;
                  return;
                }
                if (isFlipped) openWordDetails();
                else revealAnswer();
              }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={() => {
                pointerStart.current = null;
                pendingPointerPosition.current = null;
                activeDragDirection.current = null;
                setDragDirection(null);
                setDragOffset({ x: 0, y: 0 });
                setIsRecentering(false);
                setIsDragging(false);
              }}
              className="absolute inset-0 z-0 min-h-[min(52dvh,28rem)] w-full touch-none cursor-pointer rounded-3xl border border-border/80 bg-linear-to-br from-white to-zinc-100 shadow-xl focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30 sm:min-h-80 dark:from-zinc-800 dark:to-zinc-900"
              aria-pressed={isFlipped}
              aria-label={isFlipped ? 'Show word details' : 'Show answer'}
              data-testid="review-card"
            />
            <div className="pointer-events-none relative z-10 flex min-h-[min(52dvh,28rem)] w-full flex-col items-center justify-center p-5 text-center sm:min-h-80 sm:p-8">
            {isFlipped ? (
              <div className="flex w-full max-h-[42svh] flex-col items-center gap-5 overflow-y-auto py-12 sm:max-h-56">
                <div className="flex max-w-full items-center gap-2 text-xl font-medium text-muted-foreground">
                  <span className="wrap-break-word">{card.front}</span>
                </div>
                <span className="h-px w-16 shrink-0 bg-border" />
                <span className="text-3xl font-bold wrap-break-word">
                  {card.back}
                </span>
              </div>
            ) : (
              <span className="max-h-[42svh] overflow-y-auto text-3xl font-bold wrap-break-word sm:max-h-56">
                {card.front}
              </span>
            )}
            </div>

            {dragDirection && (
              <span
                className={`pointer-events-none absolute text-sm font-semibold ${swipeFeedback[dragDirection].className}`}
                data-testid="swipe-feedback"
              >
                {swipeFeedback[dragDirection].label}
              </span>
            )}

            {isFlipped && (
              <div className="absolute bottom-16 left-1/2 flex -translate-x-1/2 items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={openWordDetails}
                  className="size-11 cursor-pointer text-muted-foreground"
                  aria-label="Open word details"
                >
                  <BookOpen className="size-5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={openSettings}
                  className="pointer-events-auto size-11 shrink-0 cursor-pointer text-muted-foreground"
                  aria-label="Open card settings"
                >
                  <Cog className="size-5" />
                </Button>
              </div>
            )}
          </div>
        </div>

        {isFlipped && (
          <div
            className="relative z-0 mt-6 grid grid-cols-3 gap-2 sm:mx-auto sm:w-full sm:max-w-xl"
            data-testid="review-answer-buttons"
          >
            <Button
              variant="outline"
              onClick={() => answerCard('forgot')}
              className="min-h-12 cursor-pointer border-border bg-muted/40 text-muted-foreground shadow-none hover:bg-muted hover:text-foreground"
            >
              Forgot
            </Button>
            <Button
              variant="outline"
              onClick={() => answerCard('hard')}
              className="min-h-12 cursor-pointer border-amber-500/50 bg-amber-50/80 text-amber-800 shadow-none hover:bg-amber-100 hover:text-amber-900 dark:bg-amber-950/30 dark:text-amber-400 dark:hover:bg-amber-950/50 dark:hover:text-amber-300"
            >
              Hard
            </Button>
            <Button
              variant="outline"
              onClick={() => answerCard('remember')}
              className="min-h-12 cursor-pointer border-emerald-500/30 text-emerald-700 shadow-none hover:bg-emerald-500/10 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300"
            >
              Remember
            </Button>
          </div>
        )}

        <Button
          variant="ghost"
          onClick={onExit}
          className="mt-6 self-center pb-[max(0.75rem,env(safe-area-inset-bottom))] cursor-pointer gap-1.5 text-muted-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to dashboard
        </Button>
      </div>

      {isWordDetailsOpen && (
        <WordDetailsDialog
          onClose={() => setIsWordDetailsOpen(false)}
          onAnswer={answerCard}
          reviewMode={reviewMode}
        />
      )}

      {isSettingsOpen && (
        <SettingsPlaceholderDialog onClose={() => setIsSettingsOpen(false)} />
      )}

      {isDeleteConfirmationOpen && (
        <DeleteConfirmationDialog
          word={card.front}
          onCancel={restoreCurrentCard}
          onConfirm={() => {
            setIsDeleteConfirmationOpen(false);
            setIsDeletePlaceholderOpen(true);
          }}
        />
      )}

      {isDeletePlaceholderOpen && (
        <DeletePlaceholderDialog
          onClose={restoreCurrentCard}
        />
      )}
    </PageContainer>
  );
}

type WordDetailsDialogProps = {
  onClose: () => void;
  onAnswer: (answer: ReviewAnswer) => void;
  reviewMode: ReviewMode;
};

function WordDetailsDialog({
  onClose,
  onAnswer,
  reviewMode,
}: WordDetailsDialogProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = pointerStart.current;
    pointerStart.current = null;
    if (!start) return;

    const horizontalDistance = event.clientX - start.x;
    const verticalDistance = event.clientY - start.y;
    if (
      Math.max(Math.abs(horizontalDistance), Math.abs(verticalDistance)) <
      SWIPE_THRESHOLD_PX
    ) {
      return;
    }

    const answer =
      Math.abs(horizontalDistance) >= Math.abs(verticalDistance)
        ? getAnswerForReviewGesture(
            reviewMode,
            horizontalDistance > 0 ? 'right' : 'left',
          )
        : verticalDistance < 0
          ? getAnswerForReviewGesture(reviewMode, 'up')
          : null;

    if (answer) onAnswer(answer);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="word-details-title"
        aria-describedby="word-details-description"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => {
          pointerStart.current = { x: event.clientX, y: event.clientY };
        }}
        onPointerUp={handlePointerUp}
        className="w-full max-w-lg rounded-3xl border border-border/80 bg-background p-5 shadow-2xl sm:p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <h2 id="word-details-title" className="text-xl font-bold">
              Word details
            </h2>
            <p
              id="word-details-description"
              className="text-sm text-muted-foreground"
            >
              Full word data will appear here when the note model is available.
            </p>
          </div>
          <Button
            ref={closeButtonRef}
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="cursor-pointer"
            aria-label="Close word details"
          >
            <X className="size-4" />
          </Button>
        </div>

      </div>
    </div>
  );
}

type DeleteConfirmationDialogProps = {
  word: string;
  onCancel: () => void;
  onConfirm: () => void;
};

function DeleteConfirmationDialog({
  word,
  onCancel,
  onConfirm,
}: DeleteConfirmationDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-word-title"
        aria-describedby="delete-word-description"
        className="w-full rounded-3xl border border-border/80 bg-background p-5 shadow-2xl sm:max-w-lg sm:p-6"
      >
        <h2 id="delete-word-title" className="text-xl font-bold">
          Delete “{word}”?
        </h2>
        <p
          id="delete-word-description"
          className="mt-2 text-sm text-muted-foreground"
        >
          This action will be available after the note model is implemented.
        </p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <Button variant="outline" onClick={onCancel} className="min-h-12 cursor-pointer">
            No
          </Button>
          <Button variant="destructive" onClick={onConfirm} className="min-h-12 cursor-pointer">
            Yes
          </Button>
        </div>
      </div>
    </div>
  );
}

function DeletePlaceholderDialog({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-placeholder-title"
        className="w-full rounded-3xl border border-border/80 bg-background p-5 shadow-2xl sm:max-w-lg sm:p-6"
      >
        <h2 id="delete-placeholder-title" className="text-xl font-bold">
          Deletion is not available yet
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          We will add this once deleting a word has a defined note and sibling-card behaviour.
        </p>
        <Button onClick={onClose} className="mt-6 min-h-12 w-full cursor-pointer">
          Close
        </Button>
      </div>
    </div>
  );
}

function SettingsPlaceholderDialog({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-placeholder-title"
        aria-describedby="settings-placeholder-description"
        className="w-full rounded-3xl border border-border/80 bg-background p-5 shadow-2xl sm:max-w-lg sm:p-6"
      >
        <h2 id="settings-placeholder-title" className="text-xl font-bold">
          Card settings
        </h2>
        <p
          id="settings-placeholder-description"
          className="mt-2 text-sm text-muted-foreground"
        >
          Card settings will be available later.
        </p>
        <Button onClick={onClose} className="mt-6 min-h-12 w-full cursor-pointer">
          Close
        </Button>
      </div>
    </div>
  );
}

function ReviewComplete({ onExit }: Pick<ReviewSessionProps, 'onExit'>) {
  return (
    <PageContainer className="max-w-3xl py-4 sm:py-6">
      <div className="flex min-h-80 flex-col items-center justify-center gap-4 text-center">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Review complete</h1>
          <p className="text-sm text-muted-foreground">
            You have reviewed every card in this session.
          </p>
        </div>
        <Button onClick={onExit} className="cursor-pointer gap-1.5">
          <ArrowLeft className="size-4" />
          Back to dashboard
        </Button>
      </div>
    </PageContainer>
  );
}
