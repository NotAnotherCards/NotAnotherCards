import { useEffect } from 'react';
import {
  getAnswerForReviewGesture,
  type ReviewAnswer,
  type ReviewMode,
} from './review-controls';

type UseReviewKeyboardShortcutsOptions = {
  isFlipped: boolean;
  isBlocked: boolean;
  reviewMode: ReviewMode;
  reviewCardElement: HTMLButtonElement | null;
  onReveal: () => void;
  onAnswer: (answer: ReviewAnswer) => void;
  onDelete: () => void;
};

function isInteractiveKeyboardTarget(target: EventTarget | null) {
  return (
    target instanceof Element &&
    target.closest(
      'input, textarea, select, button, a[href], [contenteditable="true"], [role="button"], [role="textbox"]',
    ) !== null
  );
}

export function useReviewKeyboardShortcuts({
  isFlipped,
  isBlocked,
  reviewMode,
  reviewCardElement,
  onReveal,
  onAnswer,
  onDelete,
}: UseReviewKeyboardShortcutsOptions) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isBlocked) return;
      if (
        isInteractiveKeyboardTarget(event.target) &&
        event.target !== reviewCardElement
      ) {
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
          onReveal();
        }
        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        onDelete();
        return;
      }

      const gesture =
        event.key === 'ArrowRight'
          ? 'right'
          : event.key === 'ArrowLeft'
            ? 'left'
            : event.key === 'ArrowUp'
              ? 'up'
              : null;
      if (!gesture) return;

      const answer = getAnswerForReviewGesture(reviewMode, gesture);
      if (answer) {
        event.preventDefault();
        onAnswer(answer);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isBlocked,
    isFlipped,
    onAnswer,
    onDelete,
    onReveal,
    reviewCardElement,
    reviewMode,
  ]);
}
