import { Stack, useLocalSearchParams } from 'expo-router';
// gesture-handler's ScrollView, so it lets the review card's swipe through
// instead of claiming the touch first.
import { ScrollView } from 'react-native-gesture-handler';
import { RequireSession } from '@/components/require-session';
import { ReviewSession } from '@/components/review-session';

export default function ReviewScreen() {
  const { deckId } = useLocalSearchParams<{ deckId: string }>();
  return (
    <RequireSession>
      <Stack.Screen options={{ title: 'Review' }} />
      <ScrollView
        className="flex-1 bg-background"
        contentContainerClassName="flex-grow justify-center p-6"
      >
        <ReviewSession deckId={deckId} />
      </ScrollView>
    </RequireSession>
  );
}
