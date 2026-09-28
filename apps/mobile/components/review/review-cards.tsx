import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import {
  extendedReviewAnswerLabels,
  reviewAnswerLabels,
  WORD_TO_TRANSLATION_TEMPLATE_KEY,
  type UserCardRecord,
} from '@repo/offline-db';
import type { useReviewSwipe } from '@/lib/use-review-swipe';
import { Card } from '../ui/card';
import { Markdown } from '../ui/markdown';
import { Text } from '../ui/text';
import { answerColours } from './answer-colours';

type Swipe = ReturnType<typeof useReviewSwipe>;

// The question stays and the answer appears below it, so the answer can be
// checked against the question. A tap on the question reveals, a long press
// edits (the pencil's shortcut; screen readers get it as an action). Once
// revealed, the answer card swipes and the question stays. Each card has a
// half of the space between the top row and the buttons, with web's large
// centred text; what does not fit is cut off, as on web.
export function ReviewCards({
  card,
  nextFront,
  revealed,
  busy,
  swipe,
  extended,
  deleteLabel,
  onReveal,
  onEdit,
}: {
  card: UserCardRecord;
  nextFront: string | null;
  revealed: boolean;
  busy: boolean;
  swipe: Swipe;
  extended: boolean;
  deleteLabel: string;
  onReveal: () => void;
  onEdit?: () => void;
}) {
  // The space between the top row and the buttons, measured once it lays
  // out; each card takes a 3:2 index-card shape, or half the space if that
  // is smaller. Until it is measured the two cards simply share it.
  const [area, setArea] = useState<{ width: number; height: number } | null>(
    null,
  );
  const cardSize = area
    ? { height: Math.min((area.height - 12) / 2, area.width / 1.5) }
    : { flex: 1 };
  const locked = busy || swipe.isLeaving;
  // Landed until the next card replaces the answered one.
  const hasLanded = swipe.hasLanded;

  const direction = swipe.direction;
  const swipeLabel =
    direction === 'delete'
      ? deleteLabel
      : direction
        ? extended
          ? extendedReviewAnswerLabels[direction]
          : reviewAnswerLabels[direction]
        : null;
  const swipeLabelColour =
    direction === 'delete'
      ? 'text-destructive'
      : direction
        ? answerColours[direction].text
        : 'text-muted-foreground';

  // Web shows a word card's translation large and whatever follows it
  // smaller (its [&_p+p] rule); the first blank line splits the two.
  const answerParts = card.back.split(/\n\s*\n/);
  const [answerHead, answerDetail] =
    card.template_key === WORD_TO_TRANSLATION_TEMPLATE_KEY
      ? [answerParts[0], answerParts.slice(1).join('\n\n')]
      : [card.back, ''];

  return (
    <View
      className="flex-1 justify-center gap-3"
      onLayout={(event) => setArea(event.nativeEvent.layout)}
    >
      <Pressable
        style={cardSize}
        accessibilityRole="button"
        accessibilityLabel={revealed ? 'Question' : 'Show the answer'}
        accessibilityActions={
          onEdit ? [{ name: 'edit', label: 'Edit this card' }] : []
        }
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'edit') onEdit?.();
        }}
        disabled={locked}
        onPress={onReveal}
        onLongPress={onEdit}
      >
        {hasLanded ? (
          <Card className="flex-1 items-center justify-center overflow-hidden px-6 py-6">
            {nextFront && <Markdown content={nextFront} variant="card" />}
          </Card>
        ) : null}
        {!hasLanded && nextFront && (
          <Animated.View
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[
              swipe.nextStyle,
              { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
            ]}
          >
            <Card className="flex-1 items-center justify-center overflow-hidden px-6 py-6">
              <Markdown content={nextFront} variant="card" />
            </Card>
          </Animated.View>
        )}
        {!hasLanded && (
          <Animated.View style={[swipe.questionStyle, { flex: 1 }]}>
            <Card className="flex-1 items-center justify-center overflow-hidden px-6 py-6">
              <Markdown content={card.front} variant="card" />
            </Card>
          </Animated.View>
        )}
      </Pressable>
      {/* The answer's space is kept before it shows, so revealing does not
          move the question; a tap there reveals it too. */}
      {!revealed && (
        <Pressable
          style={cardSize}
          accessibilityRole="button"
          accessibilityLabel="Answer, tap to show"
          disabled={locked}
          onPress={onReveal}
        />
      )}
      {revealed && hasLanded && (
        <View
          style={cardSize}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      )}
      {revealed && !hasLanded && (
        // Only the answer is swiped away; the question stays put.
        <GestureDetector gesture={swipe.gesture}>
          <Animated.View style={[swipe.cardStyle, cardSize]}>
            <Card
              accessibilityLabel="Answer"
              className="flex-1 items-center justify-center overflow-hidden px-6 py-6"
            >
              {swipeLabel && (
                <Text
                  className={`absolute left-0 right-0 top-3 text-center text-sm font-semibold uppercase ${swipeLabelColour}`}
                >
                  {swipeLabel}
                </Text>
              )}
              <Markdown content={answerHead} variant="card" />
              {answerDetail ? (
                <View className="mt-3">
                  <Markdown content={answerDetail} variant="card-detail" />
                </View>
              ) : null}
            </Card>
          </Animated.View>
        </GestureDetector>
      )}
    </View>
  );
}
