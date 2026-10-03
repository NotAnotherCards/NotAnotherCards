import { View } from 'react-native';
import {
  calculateReviewIntervalMinutes,
  extendedReviewAnswerLabels,
  formatReviewInterval,
  reviewAnswerLabels,
  reviewRatingByAnswer,
  type ReviewAnswer,
} from '@repo/offline-db';
import type { ReviewLayout } from '@/lib/use-review-layout';
import { Button } from '../ui/button';
import { Text } from '../ui/text';
import { answerColours } from './answer-colours';

// "Show answer" until the answer shows, then the answers of the current
// layout. A long press on an answer switches the layout.
export function AnswerButtons({
  revealed,
  locked,
  layout,
  intervalMinutes,
  onReveal,
  onAnswer,
}: {
  revealed: boolean;
  locked: boolean;
  layout: Omit<ReviewLayout, 'hint'>;
  // The card's current interval, for what each answer would schedule.
  intervalMinutes: number;
  onReveal: () => void;
  onAnswer: (answer: ReviewAnswer) => void;
}) {
  if (!revealed) {
    return (
      // 48 high, Android's touch target size, like the answers after it.
      <Button
        variant="outline"
        // Like the answers: locked for a moment, not faded.
        className="h-12 opacity-100 sm:h-12"
        disabled={locked}
        onPress={onReveal}
      >
        <Text>Show answer</Text>
      </Button>
    );
  }

  return (
    <View className="flex-row gap-2">
      {layout.answers.map((answer) => (
        <Button
          key={answer}
          variant="outline"
          // One row: four buttons are narrow, so the interval sits under the
          // label and h-auto lets the button grow for it. Locked only while
          // an answer is on its way, a moment too short to show: fading
          // them made the change flicker.
          className={`h-auto min-h-12 flex-1 flex-col gap-0.5 px-1 py-2 opacity-100 ${answerColours[answer].button}`}
          disabled={locked}
          onPress={() => onAnswer(answer)}
          // Held a little longer than the default, so a slow answer is not
          // taken for a layout switch. Never records a rating.
          delayLongPress={600}
          onLongPress={layout.switchLayout}
          accessibilityActions={[
            {
              name: 'layout',
              label: `Switch to ${layout.nextName.toLowerCase()}`,
            },
          ]}
          onAccessibilityAction={(event) => {
            if (event.nativeEvent.actionName === 'layout')
              layout.switchLayout();
          }}
        >
          <Text className={answerColours[answer].text}>
            {layout.extended
              ? extendedReviewAnswerLabels[answer]
              : reviewAnswerLabels[answer]}
          </Text>
          {layout.showIntervals && (
            <Text className="text-xs text-muted-foreground">
              {formatReviewInterval(
                calculateReviewIntervalMinutes(
                  intervalMinutes,
                  reviewRatingByAnswer[answer],
                ),
              )}
            </Text>
          )}
        </Button>
      ))}
    </View>
  );
}
