import { useTranslation } from 'react-i18next';
import {
  calculateReviewIntervalMinutes,
  reviewRatingByAnswer,
} from '@repo/offline-db';
import { Button } from '@/components/ui/button';
import type { RefObject } from 'react';
import { formatReviewInterval, type ReviewAnswer } from './review-controls';

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

// One rating hue per answer, the same as mobile's answer buttons: an
// outline in the hue at 40%, the label in the hue, a faint fill on hover.
const answerButtonClassName: Record<ReviewAnswer, string> = {
  forgot:
    'border-rating-again/40 text-rating-again shadow-none hover:bg-rating-again/10 hover:text-rating-again dark:hover:bg-rating-again/10',
  hard: 'border-rating-hard/40 text-rating-hard shadow-none hover:bg-rating-hard/10 hover:text-rating-hard dark:hover:bg-rating-hard/10',
  remember:
    'border-rating-good/40 text-rating-good shadow-none hover:bg-rating-good/10 hover:text-rating-good dark:hover:bg-rating-good/10',
  'very-easy':
    'border-rating-easy/40 text-rating-easy shadow-none hover:bg-rating-easy/10 hover:text-rating-easy dark:hover:bg-rating-easy/10',
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
  const { t } = useTranslation();
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
          className="min-h-12 w-full cursor-pointer border-primary/20 bg-primary/5 text-primary shadow-sm hover:bg-primary/10 hover:text-primary dark:border-primary/30 dark:bg-primary/10 dark:hover:bg-primary/20"
        >
          {t('review.card.show_answer', 'Show answer')}
        </Button>
      ) : (
        <div
          className={`grid gap-2 ${reviewMode === 'basic' ? 'grid-cols-2' : 'grid-cols-4'}`}
        >
          {answers.map((answer) => {
            const label = t(
              `review.answers.${answer.replace('-', '_')}`,
              answer,
            );
            const interval = calculateReviewIntervalMinutes(
              previousIntervalMinutes,
              reviewRatingByAnswer[answer],
            );

            return (
              <Button
                key={answer}
                ref={answer === answers[0] ? firstAnswerButtonRef : undefined}
                variant="outline"
                data-review-answer-button
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
