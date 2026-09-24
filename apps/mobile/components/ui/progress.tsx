import { View } from 'react-native';
import { cn } from '@/lib/utils';

// Web's Progress (value 0-100, indicatorClassName), without animation:
// react-native-reusables' version needs reanimated, a native module this
// kit has not taken on for one bar.
function Progress({
  value,
  className,
  indicatorClassName,
  accessibilityLabel,
}: {
  value: number;
  className?: string;
  indicatorClassName?: string;
  accessibilityLabel?: string;
}) {
  const percent = Math.max(0, Math.min(100, value));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: percent }}
      className={cn(
        'h-3 w-full overflow-hidden rounded-full bg-muted',
        className,
      )}
    >
      <View
        className={cn('h-full bg-primary', indicatorClassName)}
        style={{ width: `${percent}%` }}
      />
    </View>
  );
}

export { Progress };
