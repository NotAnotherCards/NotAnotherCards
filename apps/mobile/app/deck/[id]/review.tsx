import { useLocalSearchParams } from 'expo-router';
import { ScrollView } from 'react-native';
import { FlashcardView } from '@/components/flashcard-view';
import { RequireSession } from '@/components/require-session';

// Reviewing one deck (/deck/<id>/review). Nested under the deck screen so
// Back returns to its cards; FlashcardView sets the title from the record.
export default function DeckReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <RequireSession>
      <ScrollView
        className="flex-1 bg-background"
        contentContainerClassName="gap-4 p-6"
      >
        <FlashcardView deckId={id} />
      </ScrollView>
    </RequireSession>
  );
}
