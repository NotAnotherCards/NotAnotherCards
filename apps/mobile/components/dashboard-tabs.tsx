import { View } from 'react-native';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';

export type DashboardTab = 'overview' | 'library' | 'settings';

const TABS: { key: DashboardTab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'library', label: 'My Library' },
  { key: 'settings', label: 'Profile & Settings' },
];

// The web dashboard's pill row: the active tab is the filled one. Tabs are
// screen state, not routes, so switching never pushes onto the stack.
export function DashboardTabs({
  active,
  onChange,
}: {
  active: DashboardTab;
  onChange: (tab: DashboardTab) => void;
}) {
  return (
    <View className="flex-row gap-1 rounded-2xl border border-border/50 bg-muted/30 p-1.5">
      {TABS.map(({ key, label }) => (
        <Button
          key={key}
          size="sm"
          variant={active === key ? 'secondary' : 'ghost'}
          onPress={() => onChange(key)}
          className="flex-1 rounded-xl px-2"
          role="tab"
          accessibilityState={{ selected: active === key }}
        >
          <Text className="text-xs font-semibold" numberOfLines={1}>
            {label}
          </Text>
        </Button>
      ))}
    </View>
  );
}
