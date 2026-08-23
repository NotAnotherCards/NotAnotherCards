/**
 * Failing test: rating a card while the write fails (database not ready,
 * write error) must give the user feedback instead of silently losing the
 * rating. handleReview currently awaits store.recordReview without a
 * try/catch, so the rejection escapes the click handler unhandled and the
 * UI shows nothing.
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { FlashcardModal } from '@/components/deck/FlashcardModal';
import type { Card } from '@/hooks/useStore';

vi.mock('@/hooks/useStore', () => ({
  useStore: () => ({
    // Reject at call time (not mockRejectedValue, which creates the rejected
    // promise eagerly during render).
    recordReview: vi.fn(() =>
      Promise.reject(new Error('Database not initialized')),
    ),
  }),
}));

const card = {
  id: 'card-1',
  deck_id: 'deck-1',
  front: 'front side',
  back: 'back side',
} as unknown as Card;

describe('flashcard rating failure', () => {
  it('shows feedback and keeps the modal open when saving the rating fails', async () => {
    const onClose = vi.fn();
    render(<FlashcardModal card={card} onClose={onClose} />);

    // Flip to the back where the rating buttons live.
    fireEvent.click(screen.getByTestId('flashcard-inner'));
    fireEvent.click(screen.getByRole('button', { name: /again/i }));

    // Intended behavior: the failure is surfaced to the user (an element
    // with role="alert") and the modal does not close as if the rating had
    // been saved.
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});
