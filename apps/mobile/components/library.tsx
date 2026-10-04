import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';
import { CommunityDecks } from './community-decks';
import { DeckList } from './deck-list';
import { Button } from './ui/button';
import { PlusIcon } from './ui/icon';
import { Segmented } from './ui/segmented';

type Section = 'mine' | 'community';

// The library tab: my decks, or the community's, one list at a time. The
// compact create button sits beside the sections, only for my decks.
export function Library() {
  const { t } = useTranslation();
  const sections = [
    { value: 'mine', label: t('mobile.my_decks') },
    { value: 'community', label: t('mobile.community') },
  ] as const;
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
        <View className="min-w-0 flex-1">
          <Segmented
            label={t('dashboard.tabs.library')}
            role="tablist"
            value={section}
            options={sections}
            // A pending create request dies with its section, or the list
            // would reopen the form when it comes back.
            onChange={(next) => {
              setCreateRequestKey(0);
              router.setParams({ section: next });
            }}
          />
        </View>
        {section === 'mine' && (
          <Button
            size="icon"
            className="h-12 w-12 sm:h-12 sm:w-12"
            accessibilityLabel={t('deck.list.create_deck')}
            onPress={() => setCreateRequestKey((key) => key + 1)}
          >
            <PlusIcon size={20} className="text-primary-foreground" />
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
