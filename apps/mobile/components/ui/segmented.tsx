import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from './text';

// The pill row the theme toggle introduced, for any small closed choice.
// Web's Preferences uses pressed buttons for the same job. `stacked` puts
// the icon above a small label, so three labelled tabs fit a phone width.
// A preference is a radio group; the dashboard strip is a tab list, and
// screen readers announce the two differently.
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  renderIcon,
  stacked = false,
  role = 'radiogroup',
}: {
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  label: string;
  renderIcon?: (value: T, selected: boolean) => ReactNode;
  stacked?: boolean;
  role?: 'radiogroup' | 'tablist';
}) {
  const itemRole = role === 'tablist' ? 'tab' : 'radio';
  return (
    <View
      className="w-full flex-row rounded-lg bg-muted p-1"
      accessibilityRole={role}
      accessibilityLabel={label}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole={itemRole}
            accessibilityState={{ selected }}
            className={`flex-1 items-center justify-center rounded-md ${
              stacked ? 'gap-1 py-2' : 'flex-row gap-1.5 py-1.5'
            } ${selected ? 'bg-background' : ''}`}
          >
            {renderIcon?.(option.value, selected)}
            <Text
              numberOfLines={1}
              className={`${stacked ? 'text-xs' : ''} ${
                selected
                  ? 'font-semibold text-foreground'
                  : 'text-muted-foreground'
              }`}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
