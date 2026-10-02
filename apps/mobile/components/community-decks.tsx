import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { deckKindShort } from '@repo/offline-db';
import { deckTypeAccessibilityLabel } from '@repo/i18n';
import { useTranslation } from 'react-i18next';
import type { SharedDeckSummary } from '@repo/schemas';
import { Button } from './ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Text } from './ui/text';
import { apiClient } from '@/lib/api-client';

// The community decks, as web's overview lists them: kind, title,
// description, card count, author. Tapping one opens its preview. Server
// data only (published snapshots), so the list is fetched when the tab
// opens, not observed; a failed load offers a retry, and a full page offers
// the next one.
export function CommunityDecks({ pageSize = 50 }: { pageSize?: number } = {}) {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const [decks, setDecks] = useState<SharedDeckSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  const load = useCallback(
    async (offset: number) => {
      setError(null);
      setLoading(true);
      try {
        const page = (
          await apiClient.sharedDecks.list({ limit: pageSize, offset })
        ).decks;
        setDecks((current) =>
          offset === 0 ? page : [...(current ?? []), ...page],
        );
        setHasMore(page.length === pageSize);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Could not load the decks',
        );
      } finally {
        setLoading(false);
      }
    },
    [pageSize],
  );
  useEffect(() => {
    void load(0);
  }, [load]);

  return (
    <View className="gap-3">
      {decks === null && !error && (
        <ActivityIndicator accessibilityLabel="Loading community decks" />
      )}
      {error && (
        <View className="items-center gap-2">
          <Text className="text-center text-destructive">{error}</Text>
          <Button
            variant="outline"
            className="h-12 sm:h-12"
            onPress={() => void load(decks?.length ?? 0)}
          >
            <Text>Retry</Text>
          </Button>
        </View>
      )}
      {decks?.length === 0 && (
        <Text className="text-center text-muted-foreground">
          No community decks yet.
        </Text>
      )}
      <View role="list" className="gap-3">
        {decks?.map((deck) => {
          // The kind helpers read the offline row's field names.
          const kind = {
            note_type: deck.noteType,
            native_language_id: deck.nativeLanguageId,
            target_language_id: deck.targetLanguageId,
          };
          return (
            <Pressable
              key={deck.id}
              role="listitem"
              accessibilityRole="button"
              accessibilityLabel={`Open ${deck.title}`}
              onPress={() => router.push(`/community/${deck.id}`)}
            >
              <Card>
                <CardHeader>
                  <View className="flex-row items-center gap-2">
                    <Text
                      accessibilityLabel={deckTypeAccessibilityLabel(
                        kind,
                        i18n.resolvedLanguage ?? i18n.language,
                        (key, options) => t(`deck.type.${key}`, options),
                      )}
                      className="shrink-0 rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                    >
                      {deckKindShort(kind)}
                    </Text>
                    <CardTitle className="flex-1" numberOfLines={1}>
                      {deck.title}
                    </CardTitle>
                  </View>
                  <CardDescription numberOfLines={2}>
                    {deck.description ? `${deck.description} · ` : ''}
                    {deck.cardCount} cards · by @{deck.owner.username}
                  </CardDescription>
                </CardHeader>
              </Card>
            </Pressable>
          );
        })}
      </View>
      {hasMore && !error && (
        <Button
          variant="outline"
          className="h-12 sm:h-12"
          loading={loading}
          onPress={() => void load(decks?.length ?? 0)}
        >
          <Text>Load more</Text>
        </Button>
      )}
    </View>
  );
}
