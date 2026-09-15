import { useRouter } from 'expo-router';
import { Pressable } from 'react-native';
import { authClient } from '@/lib/auth-client';
import { initials } from './settings';
import { Text } from './ui/text';

// Web's header shows the account as an initials circle at the top right;
// here it is the way into Settings.
export function AccountButton() {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  return (
    <Pressable
      onPress={() => router.push('/settings')}
      accessibilityRole="button"
      accessibilityLabel="Account and settings"
      className="mr-1 size-9 items-center justify-center rounded-full bg-primary"
    >
      <Text className="text-sm font-bold text-primary-foreground">
        {initials(session?.user.name)}
      </Text>
    </Pressable>
  );
}
