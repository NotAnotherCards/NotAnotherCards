import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { CardList } from '@/components/card-list';
import { RequireSession } from '@/components/require-session';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';

// One deck's cards. The id comes from the URL (/deck/<id>); the deck's own
// title is the section heading inside CardList, which already has the record.
export default function DeckScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  return (
    <RequireSession>
      <Stack.Screen options={{ title: 'Deck' }} />
      <ScrollView
        className="flex-1 bg-background"
        contentContainerClassName="gap-4 p-6"
      >
        <View className="items-end">
          <Button onPress={() => router.push(`/review/${id}`)}>
            <Text>Review due cards</Text>
          </Button>
        </View>
        <CardList deckId={id} />
      </ScrollView>
    </RequireSession>
  );
}
