import { Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView } from 'react-native';
import { CardList } from '@/components/card-list';
import { RequireSession } from '@/components/require-session';

// One deck's cards. The id comes from the URL (/deck/<id>); the deck's own
// title is the section heading inside CardList, which already has the record.
export default function DeckScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <RequireSession>
      <Stack.Screen options={{ title: 'Deck' }} />
      <ScrollView
        className="flex-1 bg-background"
        contentContainerClassName="gap-4 p-6"
      >
        <CardList deckId={id} />
      </ScrollView>
    </RequireSession>
  );
}
