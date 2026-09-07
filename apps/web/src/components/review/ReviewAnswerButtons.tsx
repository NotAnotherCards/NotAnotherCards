import { Button } from '@/components/ui/button';
import { reviewAnswerLabels, type ReviewAnswer } from './review-controls';

type ReviewAnswerButtonsProps = {
  active: boolean;
  disabled: boolean;
  onAnswer: (answer: ReviewAnswer) => Promise<void>;
  onReveal: () => void;
};

export function ReviewAnswerButtons({
  active,
  disabled,
  onAnswer,
  onReveal,
}: ReviewAnswerButtonsProps) {
  const answerButtonClassName = active
    ? {
        forgot:
          'border-border bg-muted/40 text-muted-foreground shadow-none hover:bg-muted hover:text-foreground',
        hard: 'border-amber-500/50 bg-amber-50/80 text-amber-800 shadow-none hover:bg-amber-100 hover:text-amber-900 dark:bg-amber-950/30 dark:text-amber-400 dark:hover:bg-amber-950/50 dark:hover:text-amber-300',
        remember:
          'border-emerald-500/30 text-emerald-700 shadow-none hover:bg-emerald-500/10 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300',
        'very-easy':
          'border-blue-500/30 text-blue-700 shadow-none hover:bg-blue-500/10 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300',
      }
    : {
        forgot:
          'border-border bg-muted/40 text-muted-foreground shadow-none hover:bg-muted hover:text-foreground',
        hard: 'border-border bg-muted/40 text-muted-foreground shadow-none hover:bg-muted hover:text-foreground',
        remember:
          'border-border bg-muted/40 text-muted-foreground shadow-none hover:bg-muted hover:text-foreground',
        'very-easy':
          'border-border bg-muted/40 text-muted-foreground shadow-none hover:bg-muted hover:text-foreground',
      };

  const handleAnswer = (answer: ReviewAnswer) => (event: React.MouseEvent) => {
    if (disabled) return;

    if (!active) {
      event.stopPropagation();
      onReveal();
      return;
    }

    event.stopPropagation();
    void onAnswer(answer);
  };

  return (
    <div
      className="grid grid-cols-3 gap-2"
      data-testid={
        active ? 'review-answer-buttons' : 'review-front-answer-buttons'
      }
    >
      <Button
        variant="outline"
        onClick={handleAnswer('forgot')}
        disabled={disabled}
        className={`min-h-12 cursor-pointer ${answerButtonClassName.forgot}`}
      >
        {reviewAnswerLabels.forgot}
      </Button>
      <Button
        variant="outline"
        onClick={handleAnswer('hard')}
        disabled={disabled}
        className={`min-h-12 cursor-pointer ${answerButtonClassName.hard}`}
      >
        {reviewAnswerLabels.hard}
      </Button>
      <Button
        variant="outline"
        onClick={handleAnswer('remember')}
        disabled={disabled}
        className={`min-h-12 cursor-pointer ${answerButtonClassName.remember}`}
      >
        {reviewAnswerLabels.remember}
      </Button>
      <Button
        variant="outline"
        onClick={handleAnswer('very-easy')}
        disabled={disabled}
        className={`col-start-2 min-h-12 cursor-pointer ${answerButtonClassName['very-easy']}`}
      >
        {reviewAnswerLabels['very-easy']}
      </Button>
    </div>
  );
}
