import { useTranslation } from 'react-i18next';
import { Stack, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { CardList } from '@/components/card-list';
import { RequireSession } from '@/components/require-session';

// One deck's cards. The id comes from the URL (/deck/<id>); the deck's own
// title is the section heading inside CardList, which already has the record.
// Reviewing starts from the library, whatever is due: the review screen
// itself offers to activate more when nothing is.
export default function DeckScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <RequireSession>
      <Stack.Screen options={{ title: t('mobile.messages.deck_header') }} />
      <View className="flex-1 bg-surface">
        <CardList deckId={id} />
      </View>
    </RequireSession>
  );
}
