import { fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ReviewCard } from '@/components/review/ReviewCard';
import type { Card } from '@/hooks/useStore';

const card = {
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
} satisfies Card;

describe('ReviewCard', () => {
  it('renders the card faces and forwards pointer gestures', () => {
    const onPointerDown = vi.fn();
    const onPointerMove = vi.fn();
    const onPointerUp = vi.fn();

    render(
      <ReviewCard
        card={card}
        isFlipped={false}
        isDragging={false}
        isSettlingDrag={false}
        dragOffset={{ x: 0, y: 0 }}
        dragDirection={null}
        exitDirection={null}
        cardButtonRef={createRef<HTMLButtonElement>()}
        onClick={vi.fn()}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={vi.fn()}
        onSettled={vi.fn()}
      />,
    );

    const surface = screen.getByTestId('review-card-surface');
    expect(surface).toHaveAttribute('data-card-id', 'card-1');
    expect(screen.getByTestId('review-card-flip')).toHaveAttribute(
      'data-flipped',
      'false',
    );

    fireEvent.pointerDown(surface, { clientX: 10, clientY: 10 });
    fireEvent.pointerMove(surface, { clientX: 70, clientY: 10 });
    fireEvent.pointerUp(surface, { clientX: 70, clientY: 10 });

    expect(onPointerDown).toHaveBeenCalledOnce();
    expect(onPointerMove).toHaveBeenCalledOnce();
    expect(onPointerUp).toHaveBeenCalledOnce();
  });
});
