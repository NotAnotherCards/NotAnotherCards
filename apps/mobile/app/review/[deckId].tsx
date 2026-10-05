import { useTranslation } from 'react-i18next';
import { Stack, useLocalSearchParams } from 'expo-router';
// gesture-handler's ScrollView, so it lets the review card's swipe through
// instead of claiming the touch first.
import { ScrollView } from 'react-native-gesture-handler';
import { RequireSession } from '@/components/require-session';
import { ReviewSession } from '@/components/review-session';

export default function ReviewScreen() {
  const { t } = useTranslation();
  const { deckId } = useLocalSearchParams<{ deckId: string }>();
  return (
    <RequireSession>
      {/* ReviewSession sets the deck title once it has loaded. */}
      <Stack.Screen options={{ title: t('review.title') }} />
      <ScrollView
        className="flex-1 bg-surface"
        contentContainerClassName="flex-grow justify-center p-6"
        keyboardShouldPersistTaps="handled"
      >
        <ReviewSession deckId={deckId} />
      </ScrollView>
    </RequireSession>
  );
}
