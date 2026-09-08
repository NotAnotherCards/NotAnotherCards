import { calculateReviewIntervalMinutes } from '@repo/offline-db';
import { Button } from '@/components/ui/button';
import type { RefObject } from 'react';
import {
  extendedReviewAnswerLabels,
  formatReviewInterval,
  reviewAnswerLabels,
  type ReviewAnswer,
} from './review-controls';

type ReviewAnswerButtonsProps = {
  active: boolean;
  disabled: boolean;
  reviewMode: 'basic' | 'extended';
  showNextReviewInterval: boolean;
  previousIntervalMinutes: number;
  firstAnswerButtonRef: RefObject<HTMLButtonElement | null>;
  onAnswer: (answer: ReviewAnswer) => Promise<void>;
  onReveal: () => void;
};

const reviewRatingByAnswer: Record<ReviewAnswer, number> = {
  forgot: 1,
  hard: 2,
  remember: 3,
  'very-easy': 4,
};

const answerButtonClassName: Record<ReviewAnswer, string> = {
  forgot:
    'border-border bg-muted/40 text-muted-foreground shadow-none hover:bg-muted hover:text-foreground',
  hard: 'border-amber-500/50 bg-amber-50/80 text-amber-800 shadow-none hover:bg-amber-100 hover:text-amber-900 dark:bg-amber-950/30 dark:text-amber-400 dark:hover:bg-amber-950/50 dark:hover:text-amber-300',
  remember:
    'border-emerald-500/30 text-emerald-700 shadow-none hover:bg-emerald-500/10 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300',
  'very-easy':
    'border-blue-500/30 text-blue-700 shadow-none hover:bg-blue-500/10 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300',
};

/** Answer controls shown below the current review card. */
export function ReviewAnswerButtons({
  active,
  disabled,
  reviewMode,
  showNextReviewInterval,
  previousIntervalMinutes,
  firstAnswerButtonRef,
  onAnswer,
  onReveal,
}: ReviewAnswerButtonsProps) {
  const answers: ReviewAnswer[] =
    reviewMode === 'basic'
      ? ['forgot', 'remember']
      : ['forgot', 'hard', 'remember', 'very-easy'];

  return (
    <div
      data-testid={
        active ? 'review-answer-buttons' : 'review-front-answer-buttons'
      }
    >
      {!active ? (
        <Button
          variant="outline"
          onClick={onReveal}
          disabled={disabled}
          className="min-h-12 w-full cursor-pointer border-border bg-muted/40 text-muted-foreground shadow-none hover:bg-muted hover:text-foreground"
        >
          Show answer
        </Button>
      ) : (
        <div
          className={`grid gap-2 ${reviewMode === 'basic' ? 'grid-cols-2' : 'grid-cols-4'}`}
        >
          {answers.map((answer) => {
            const label =
              reviewMode === 'extended'
                ? extendedReviewAnswerLabels[answer]
                : reviewAnswerLabels[answer];
            const interval = calculateReviewIntervalMinutes(
              previousIntervalMinutes,
              reviewRatingByAnswer[answer],
            );

            return (
              <Button
                key={answer}
                ref={answer === answers[0] ? firstAnswerButtonRef : undefined}
                variant="outline"
                onClick={() => void onAnswer(answer)}
                disabled={disabled}
                className={`min-h-12 min-w-0 cursor-pointer flex-col gap-0 whitespace-normal ${answerButtonClassName[answer]}`}
              >
                <span>{label}</span>
                {showNextReviewInterval && (
                  <span className="text-xs font-normal leading-4 opacity-80">
                    {formatReviewInterval(interval)}
                  </span>
                )}
              </Button>
            );
          })}
        </div>
      )}
    </div>
  );
}
