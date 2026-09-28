import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useWindowDimensions } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import type { ReviewAnswer } from '@repo/offline-db';
import {
  getSwipeDirection,
  type ReviewMode,
  type ReviewSwipeDirection,
} from '@repo/study';

export type SwipeDirection = ReviewSwipeDirection | 'very-easy';

// Where the review stands: the batch shown and the card's place in it.
// Every move gives a new one, so a card that comes back in a later batch
// is not taken for the one that just flew.
type Position = { batch: object | null; index: number };

// The answer card's swipe: the card follows the finger, the direction it
// would give shows in its header until it is let go, and a committed swipe
// throws it off and answers. Web's rules (@repo/study): left forgot, right
// remember, up hard with four answers, down delete. A quarter of the screen
// commits; with four answers, down and to the right answers easy, towards
// its button (web has no easy swipe yet).
//
// The options are read on every render, so the gesture never acts on a card
// or a reveal state from an earlier render. Without a card, pass
// `enabled: false`.
export function useReviewSwipe(options: {
  position: Position;
  // The batch has a card after this one, to fade in behind it.
  hasNext: boolean;
  mode: ReviewMode;
  // Revealed and not busy; otherwise a drag only settles back.
  enabled: boolean;
  // Down only means something for a card the editor can delete.
  canDelete: boolean;
  // Resolves false when the answer was not saved; the card then comes back
  // to be retried.
  onAnswer: (answer: ReviewAnswer) => Promise<boolean>;
  onDelete: () => void;
}) {
  const { position, hasNext } = options;
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const offsetX = useSharedValue(0);
  const offsetY = useSharedValue(0);
  const [direction, setDirection] = useState<SwipeDirection | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // From a committed swipe until its answer is recorded the card is
  // leaving: buttons and gestures wait, so nothing answers it twice.
  const [isLeaving, setIsLeaving] = useState(false);
  // Once the card has flown, the screen shows what comes next as plain
  // views: the next question at full strength and no answer card, until
  // the next card is in place. Nothing then depends on when the UI thread
  // takes back the flown-off offset, which made the next question vanish
  // for a frame and come back.
  const [landed, setLanded] = useState<Position | null>(null);
  const hasLanded =
    !!landed &&
    landed.batch === position.batch &&
    landed.index === position.index;
  const handlers = useRef<{
    update: (dx: number, dy: number) => void;
    end: (dx: number, dy: number) => void;
    cancel: () => void;
  } | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  useLayoutEffect(() => {
    if (!landed) return;
    offsetX.value = 0;
    offsetY.value = 0;
  }, [landed, offsetX, offsetY]);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: offsetX.value },
      { translateY: offsetY.value },
      { rotate: `${(offsetX.value / width) * 12}deg` },
    ],
  }));
  // As the answer is dragged away the question fades out over the first
  // half of the way and the next question comes in over the second, growing
  // from 95%, so the two never show at once. Complete at 60% of the width,
  // the next card is in place when the answer has flown. Without a next card
  // in this batch the question only fades to a fifth.
  const questionStyle = useAnimatedStyle(() => {
    const progress = Math.min(
      1,
      Math.max(Math.abs(offsetX.value), Math.abs(offsetY.value)) /
        (width * 0.6),
    );
    return {
      opacity: hasNext
        ? Math.max(0, 1 - progress * 2)
        : Math.max(0.2, 1 - progress),
    };
  });
  const nextStyle = useAnimatedStyle(() => {
    const progress = Math.min(
      1,
      Math.max(Math.abs(offsetX.value), Math.abs(offsetY.value)) /
        (width * 0.6),
    );
    const secondHalf = Math.max(0, progress * 2 - 1);
    return {
      opacity: secondHalf,
      transform: [{ scale: 0.95 + 0.05 * secondHalf }],
    };
  });

  const directionFor = (dx: number, dy: number) => {
    const next = getSwipeDirection(options.mode, dx, dy, width * 0.25, true);
    return next === 'delete' && !options.canDelete ? null : next;
  };
  const settle = () => {
    offsetX.value = withSpring(0);
    offsetY.value = withSpring(0);
    setDirection(null);
  };
  const finish = (next: SwipeDirection | null) => {
    if (!next) return settle();
    if (next === 'delete') {
      settle();
      options.onDelete();
      return;
    }
    setDirection(null);
    setIsLeaving(true);
    const answerNow = () => {
      setIsLeaving(false);
      setLanded(position);
      void options.onAnswer(next).then((saved) => {
        if (!saved) setLanded(null);
      });
    };
    if (reduceMotion) return answerNow();
    // The card leaves the way it was thrown, then the answer is recorded.
    // The next question comes in over the same time, so this also sets how
    // fast it appears.
    const away = width * 1.5;
    const flight = 260;
    if (next === 'hard')
      offsetY.value = withTiming(-away, { duration: flight });
    else
      offsetX.value = withTiming(next === 'forgot' ? -away : away, {
        duration: flight,
      });
    if (next === 'very-easy')
      offsetY.value = withTiming(away, { duration: flight });
    timer.current = setTimeout(answerNow, flight);
  };
  handlers.current = {
    update: (dx, dy) => {
      if (!options.enabled || isLeaving) return;
      offsetX.value = dx;
      offsetY.value = dy;
      setDirection(directionFor(dx, dy));
    },
    end: (dx, dy) => {
      // A card already leaving keeps flying; only a live one settles back.
      if (isLeaving) return;
      if (!options.enabled) return settle();
      finish(directionFor(dx, dy));
    },
    cancel: () => {
      if (!isLeaving) settle();
    },
  };
  const gesture = Gesture.Pan()
    .withTestId('review-card-swipe')
    .runOnJS(true)
    // A tap flips and a long press edits; only a real drag becomes a swipe.
    .activeOffsetX([-12, 12])
    .activeOffsetY([-12, 12])
    .onUpdate((event) =>
      handlers.current?.update(event.translationX, event.translationY),
    )
    .onEnd((event) =>
      handlers.current?.end(event.translationX, event.translationY),
    )
    .onFinalize((_event, success) => {
      if (!success) handlers.current?.cancel();
    });

  return {
    cardStyle,
    questionStyle,
    nextStyle,
    direction,
    isLeaving,
    hasLanded,
    gesture,
  };
}
