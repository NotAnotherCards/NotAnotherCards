import { Pressable, View } from 'react-native';
import { Text } from './text';

// The pill row the theme toggle introduced, for any small closed choice.
// Web's Preferences uses pressed buttons for the same job.
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <View
      className="flex-row rounded-lg bg-muted p-1"
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            className={`flex-1 items-center rounded-md py-1.5 ${
              selected ? 'bg-background' : ''
            }`}
          >
            <Text
              className={
                selected
                  ? 'font-semibold text-foreground'
                  : 'text-muted-foreground'
              }
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
