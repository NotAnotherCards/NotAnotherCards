import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer';
import type { Card } from '@/hooks/useStore';
import type { CSSProperties, PointerEvent, RefObject } from 'react';
import type { ReviewCardSwipeDirection } from './useReviewCardInteraction';

export type ReviewCardExitDirection = ReviewCardSwipeDirection;

type ReviewCardProps = {
  card: Card;
  nextCard?: Card;
  followingCard?: Card;
  isFlipped: boolean;
  isDragging: boolean;
  isSettlingDrag: boolean;
  dragOffset: { x: number; y: number };
  dragDirection: ReviewCardSwipeDirection | null;
  exitDirection: ReviewCardExitDirection | null;
  cardButtonRef: RefObject<HTMLButtonElement | null>;
  onClick: () => void;
  onPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerCancel: () => void;
  onSettled: () => void;
};

const MAX_DRAG_DISTANCE_X_PX = 96;
const MAX_DRAG_ROTATION_DEG = 4;
const REVIEW_CARD_FLIP_DURATION_MS = 300;

const exitTransformByDirection: Record<ReviewCardExitDirection, string> = {
  forgot: 'translate3d(-120vw, 0, 0) rotate(-10deg)',
  remember: 'translate3d(120vw, 0, 0) rotate(10deg)',
  hard: 'translate3d(0, -120dvh, 0) rotate(0deg)',
  delete: 'translate3d(0, 120dvh, 0) rotate(0deg)',
};

const swipeFeedback: Record<
  ReviewCardSwipeDirection,
  { label: string; className: string }
> = {
  forgot: {
    label: 'Forgot',
    className: 'right-5 top-5 text-right text-muted-foreground',
  },
  remember: {
    label: 'Remembered',
    className: 'left-5 top-5 text-emerald-700 dark:text-emerald-400',
  },
  hard: {
    label: 'Struggled',
    className:
      'bottom-5 left-1/2 -translate-x-1/2 text-amber-700 dark:text-amber-400',
  },
  delete: {
    label: 'Delete word',
    className: 'left-1/2 top-5 -translate-x-1/2 text-destructive',
  },
};

/** Visual card stack and animation surface for deck review. */
export function ReviewCard({
  card,
  nextCard,
  followingCard,
  isFlipped,
  isDragging,
  isSettlingDrag,
  dragOffset,
  dragDirection,
  exitDirection,
  cardButtonRef,
  onClick,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onSettled,
}: ReviewCardProps) {
  const style: CSSProperties | undefined = exitDirection
    ? { transform: exitTransformByDirection[exitDirection] }
    : isFlipped
      ? {
          transform: `translate3d(${dragOffset.x}px, ${dragOffset.y}px, 0) rotate(${(dragOffset.x / MAX_DRAG_DISTANCE_X_PX) * MAX_DRAG_ROTATION_DEG}deg)`,
        }
      : undefined;

  return (
    <div className="relative z-10 w-full sm:max-w-xl sm:self-center">
      {followingCard && (
        <div
          className="pointer-events-none absolute inset-x-0 top-3 z-0 min-h-[min(52dvh,28rem)] w-full rounded-3xl border border-border/80 bg-white shadow-xl sm:min-h-80 dark:bg-zinc-800"
          data-testid="following-review-card-outline"
          aria-hidden="true"
        />
      )}
      {nextCard && (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-1 flex min-h-[min(52dvh,28rem)] w-full items-center justify-center rounded-3xl border border-border/80 bg-linear-to-br from-white to-zinc-100 p-5 text-center shadow-xl sm:min-h-80 sm:p-8 dark:from-zinc-800 dark:to-zinc-900"
          data-testid="next-review-card"
          aria-hidden="true"
        >
          <MarkdownRenderer
            content={nextCard.front}
            className="max-h-full max-w-full overflow-hidden text-3xl font-bold wrap-break-word [&_img]:max-h-48 [&_img]:max-w-full [&_img]:object-contain"
          />
        </div>
      )}
      <div
        key={card.id}
        className={`relative z-10 ${isDragging ? '' : 'transition-transform duration-[250ms] ease-out'}`}
        style={style}
        data-testid="review-card-surface"
        data-card-id={card.id}
        onClick={onClick}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onTransitionEnd={(event) => {
          if (event.target === event.currentTarget && isSettlingDrag) {
            onSettled();
          }
        }}
      >
        <button
          ref={cardButtonRef}
          type="button"
          className="absolute inset-0 z-20 min-h-[min(52dvh,28rem)] w-full touch-none select-none cursor-pointer rounded-3xl focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30 sm:min-h-80"
          aria-pressed={isFlipped}
          aria-label={isFlipped ? 'Answer is shown' : 'Show answer'}
          data-testid="review-card"
        />
        <div className="relative min-h-[min(52dvh,28rem)] w-full [perspective:1200px] sm:min-h-80">
          <div
            className={`relative z-10 flex min-h-[min(52dvh,28rem)] w-full [transform-style:preserve-3d] transition-transform ease-in-out motion-reduce:transition-none sm:min-h-80 ${isFlipped ? '[transform:rotateY(180deg)]' : ''}`}
            data-flipped={isFlipped}
            data-testid="review-card-flip"
            style={{ transitionDuration: `${REVIEW_CARD_FLIP_DURATION_MS}ms` }}
          >
            <div
              aria-hidden={isFlipped}
              className="absolute inset-0 flex min-h-[min(52dvh,28rem)] w-full flex-col items-center justify-center overflow-hidden rounded-3xl border border-border/80 bg-linear-to-br from-white to-zinc-100 p-5 text-center shadow-xl [backface-visibility:hidden] sm:min-h-80 sm:p-8 dark:from-zinc-800 dark:to-zinc-900"
            >
              <MarkdownRenderer
                content={card.front}
                data-testid="review-card-front-content"
                className="max-h-full max-w-full overflow-hidden text-3xl font-bold wrap-break-word [&_img]:max-h-48 [&_img]:max-w-full [&_img]:object-contain"
              />
            </div>
            <div
              aria-hidden={!isFlipped}
              className="absolute inset-0 flex min-h-[min(52dvh,28rem)] w-full flex-col items-center justify-center overflow-hidden rounded-3xl border border-border/80 bg-linear-to-br from-white to-zinc-100 p-5 text-center shadow-xl [backface-visibility:hidden] [transform:rotateY(180deg)] sm:min-h-80 sm:p-8 dark:from-zinc-800 dark:to-zinc-900"
            >
              <div className="flex max-h-full w-full flex-col items-center gap-5 overflow-hidden py-12">
                <MarkdownRenderer
                  content={card.front}
                  className="max-h-full max-w-full overflow-hidden text-center text-xl font-medium text-muted-foreground wrap-break-word [&_img]:max-h-32 [&_img]:max-w-full [&_img]:object-contain"
                />
                <span className="h-px w-16 shrink-0 bg-border" />
                <MarkdownRenderer
                  content={card.back}
                  data-testid="review-card-back-content"
                  className="max-h-full max-w-full overflow-hidden text-3xl font-bold text-center wrap-break-word [&_img]:max-h-48 [&_img]:max-w-full [&_img]:object-contain [&_ul]:mt-4 [&_ul]:text-xl [&_ul]:font-normal"
                />
              </div>
            </div>
          </div>
        </div>
        {dragDirection && (
          <span
            className={`pointer-events-none absolute z-30 text-sm font-semibold ${swipeFeedback[dragDirection].className}`}
            data-testid="swipe-feedback"
          >
            {swipeFeedback[dragDirection].label}
          </span>
        )}
      </div>
    </div>
  );
}
