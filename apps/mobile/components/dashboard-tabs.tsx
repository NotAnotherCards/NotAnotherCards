import { View } from 'react-native';
import { useColorScheme } from 'nativewind';
import { navigationColors } from '@/lib/theme';
import { BookOpen, Library, Settings } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';

export type DashboardTab = 'overview' | 'library' | 'settings';

// The same lucide icons the web's tab row uses.
const TABS: { key: DashboardTab; label: string; Icon: LucideIcon }[] = [
  { key: 'overview', label: 'Overview', Icon: BookOpen },
  { key: 'library', label: 'My Library', Icon: Library },
  { key: 'settings', label: 'Profile & Settings', Icon: Settings },
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
  // Icons take a colour prop, not a className, so resolve it as the
  // navigation theme does.
  const { colorScheme } = useColorScheme();
  const { foreground } =
    navigationColors[colorScheme === 'dark' ? 'dark' : 'light'];
  return (
    <View className="flex-row gap-1 rounded-2xl border border-border/50 bg-muted/30 p-1.5">
      {TABS.map(({ key, label, Icon }) => (
        <Button
          key={key}
          size="sm"
          variant={active === key ? 'secondary' : 'ghost'}
          onPress={() => onChange(key)}
          className="flex-1 rounded-xl px-2"
          role="tab"
          accessibilityState={{ selected: active === key }}
        >
          <View className="flex-row items-center gap-1.5">
            <Icon size={14} color={foreground} />
            <Text className="text-xs font-semibold" numberOfLines={1}>
              {label}
            </Text>
          </View>
        </Button>
      ))}
    </View>
  );
}
