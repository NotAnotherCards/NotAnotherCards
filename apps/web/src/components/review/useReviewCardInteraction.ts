import { useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import {
  getAnswerForReviewGesture,
  type ReviewAnswer,
  type ReviewMode,
} from './review-controls';

export type ReviewCardSwipeDirection =
  Exclude<ReviewAnswer, 'very-easy'> | 'delete';

const SWIPE_THRESHOLD_PX = 48;
const SWIPE_FEEDBACK_THRESHOLD_PX = 1;
const MAX_DRAG_DISTANCE_X_PX = 96;
const MAX_DRAG_DISTANCE_Y_PX = 72;

type UseReviewCardInteractionOptions = {
  isFlipped: boolean;
  isBlocked: boolean;
  reviewMode: ReviewMode;
  onReveal: () => void;
  onAnswer: (answer: Exclude<ReviewAnswer, 'very-easy'>) => void;
  onDelete: () => void;
};

function isReviewCardControl(target: EventTarget | null) {
  return (
    target instanceof Element &&
    target.closest('[data-review-card-control]') !== null
  );
}

export function useReviewCardInteraction({
  isFlipped,
  isBlocked,
  reviewMode,
  onReveal,
  onAnswer,
  onDelete,
}: UseReviewCardInteractionOptions) {
  const [dragDirection, setDragDirection] =
    useState<ReviewCardSwipeDirection | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isSettlingDrag, setIsSettlingDrag] = useState(false);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const didHandleSwipe = useRef(false);

  const getSwipeDirection = (
    horizontalDistance: number,
    verticalDistance: number,
    threshold: number,
  ): ReviewCardSwipeDirection | null => {
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

  const settleCardAtCenter = () => {
    setIsDragging(false);
    setIsSettlingDrag(true);
    setDragOffset({ x: 0, y: 0 });
  };

  return {
    dragDirection,
    dragOffset,
    isDragging,
    isSettlingDrag,
    handleCardClick: () => {
      if (isBlocked) return;
      if (didHandleSwipe.current) {
        didHandleSwipe.current = false;
        return;
      }
      if (!isFlipped) onReveal();
    },
    handlePointerDown: (event: PointerEvent<HTMLDivElement>) => {
      if (isBlocked || isReviewCardControl(event.target)) return;
      event.preventDefault();

      if (!isFlipped) {
        pointerStart.current = null;
        didHandleSwipe.current = true;
        onReveal();
        return;
      }

      event.currentTarget.setPointerCapture?.(event.pointerId);
      pointerStart.current = { x: event.clientX, y: event.clientY };
      didHandleSwipe.current = false;
      setDragDirection(null);
      setDragOffset({ x: 0, y: 0 });
      setIsSettlingDrag(false);
      setIsDragging(true);
    },
    handlePointerMove: (event: PointerEvent<HTMLDivElement>) => {
      if (isBlocked || !isFlipped || !pointerStart.current) return;
      event.preventDefault();

      const horizontalDistance = event.clientX - pointerStart.current.x;
      const verticalDistance = event.clientY - pointerStart.current.y;
      const isHorizontalDrag =
        Math.abs(horizontalDistance) >= Math.abs(verticalDistance);
      const nextDirection = getSwipeDirection(
        horizontalDistance,
        verticalDistance,
        SWIPE_FEEDBACK_THRESHOLD_PX,
      );

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
      if (nextDirection) setDragDirection(nextDirection);
    },
    handlePointerUp: (event: PointerEvent<HTMLDivElement>) => {
      if (isBlocked || isReviewCardControl(event.target)) return;
      const start = pointerStart.current;
      pointerStart.current = null;
      setIsDragging(false);
      if (!start) return;
      event.preventDefault();

      const direction = getSwipeDirection(
        event.clientX - start.x,
        event.clientY - start.y,
        SWIPE_THRESHOLD_PX,
      );
      if (!direction) {
        settleCardAtCenter();
        return;
      }

      didHandleSwipe.current = true;
      if (direction === 'delete') onDelete();
      else onAnswer(direction);
    },
    handlePointerCancel: () => {
      if (!pointerStart.current) return;
      pointerStart.current = null;
      settleCardAtCenter();
    },
    handleSettled: () => {
      setDragDirection(null);
      setIsSettlingDrag(false);
    },
    clearDrag: () => {
      setDragDirection(null);
      setDragOffset({ x: 0, y: 0 });
    },
    stopDrag: () => {
      setIsDragging(false);
      setIsSettlingDrag(false);
    },
  };
}
