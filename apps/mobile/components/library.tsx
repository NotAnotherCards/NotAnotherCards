import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';
import { CommunityDecks } from './community-decks';
import { DeckList } from './deck-list';
import { Button } from './ui/button';
import { PlusIcon } from './ui/icon';
import { Segmented } from './ui/segmented';
import { Text } from './ui/text';

const SECTIONS = [
  { value: 'mine', label: 'My decks' },
  { value: 'community', label: 'Community' },
] as const;
type Section = (typeof SECTIONS)[number]['value'];

// The library tab: my decks, or the community's, one list at a time. The
// plus for a new deck shares the section row and shows only for my decks.
export function Library() {
  const router = useRouter();
  const { section: requestedSection } = useLocalSearchParams<{
    section?: string;
  }>();
  const section: Section =
    requestedSection === 'community' ? 'community' : 'mine';
  const [createRequestKey, setCreateRequestKey] = useState(0);
  return (
    <View className="gap-4">
      <View className="flex-row items-center gap-2">
        <View className="flex-1">
          <Segmented
            label="Library sections"
            role="tablist"
            value={section}
            options={SECTIONS}
            // A pending create request dies with its section, or the list
            // would reopen the form when it comes back.
            onChange={(next) => {
              setCreateRequestKey(0);
              router.setParams({ section: next });
            }}
          />
        </View>
        {section === 'mine' && (
          // Web's Create Deck, at the segment row's height.
          <Button
            className="h-12 gap-1.5 sm:h-12"
            accessibilityLabel="Create deck"
            onPress={() => setCreateRequestKey((key) => key + 1)}
          >
            <PlusIcon size={16} className="text-primary-foreground" />
            <Text>Create deck</Text>
          </Button>
        )}
      </View>
      {section === 'mine' ? (
        <DeckList createRequestKey={createRequestKey} />
      ) : (
        <CommunityDecks />
      )}
    </View>
  );
}
