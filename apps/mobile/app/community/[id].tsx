import { useCallback, useEffect, useRef, useState } from 'react';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, ScrollView, TextInput, View } from 'react-native';
import { deckTypeAccessibilityLabel } from '@repo/i18n';
import { useTranslation } from 'react-i18next';
import type { SharedDeckPreview } from '@repo/schemas';
import { RequireSession } from '@/components/require-session';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Markdown } from '@/components/ui/markdown';
import { Text } from '@/components/ui/text';
import { useSessionDatabase } from '@/lib/database-provider';
import { syncFailure } from '@/lib/sync-outcome';
import { apiClient } from '@/lib/api-client';

type Preview = SharedDeckPreview['deck'];

// One community deck: its cards (text only, as the server serves them) and
// the two actions web's overview offers. Import copies the deck on the
// server and a sync brings it to the device; then the library shows it.
// Report asks for a reason in place, as the library's delete does.
export default function CommunityDeckScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { syncController } = useSessionDatabase();
  const [deck, setDeck] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<'import' | 'report' | null>(null);
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState('');
  const [done, setDone] = useState<string | null>(null);
  // Imported on the server but not yet on this device: the next step is a
  // sync, never a second import.
  const [awaitingSync, setAwaitingSync] = useState(false);
  // An import can finish after the user has left; it must not navigate
  // whatever screen is showing by then.
  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );

  const load = useCallback(() => {
    setError(null);
    apiClient.sharedDecks
      .preview(id)
      .then((result) => setDeck(result.deck))
      .catch((err: unknown) =>
        setError(
          err instanceof Error ? err.message : 'Could not load the deck',
        ),
      );
  }, [id]);
  useEffect(load, [load]);

  // The copy is on the server once the import answers; the sync brings it
  // here. Back to the library only when it arrived and this screen is
  // still the one showing.
  const bringHome = async () => {
    const failure = await syncFailure(await syncController?.syncNow());
    if (!mounted.current) return;
    if (failure) {
      setAwaitingSync(true);
      setDone(
        `Imported. It appears in your library after the next sync. ${failure}`,
      );
      return;
    }
    router.dismissTo({
      pathname: '/dashboard',
      params: { tab: 'library', section: 'mine' },
    });
  };

  const run = async (
    action: 'import' | 'report',
    work: () => Promise<void>,
  ) => {
    setError(null);
    setPending(action);
    try {
      await work();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The request failed');
    } finally {
      setPending(null);
    }
  };

  return (
    <RequireSession>
      <Stack.Screen options={{ title: deck?.title ?? 'Community deck' }} />
      <ScrollView
        className="flex-1 bg-background"
        contentContainerClassName="gap-4 p-6"
        keyboardShouldPersistTaps="handled"
      >
        {!deck && !error && (
          <ActivityIndicator accessibilityLabel="Loading the deck" />
        )}
        {error && (
          <View className="items-center gap-2">
            <Text className="text-center text-destructive">{error}</Text>
            {/* Only a failed load retries here; a failed action keeps
                its buttons. */}
            {!deck && (
              <Button variant="outline" className="h-12 sm:h-12" onPress={load}>
                <Text>Retry</Text>
              </Button>
            )}
          </View>
        )}
        {deck && (
          <>
            <View className="gap-1">
              <Text className="text-sm text-muted-foreground">
                {deckTypeAccessibilityLabel(
                  {
                    note_type: deck.noteType,
                    native_language_id: deck.nativeLanguageId,
                    target_language_id: deck.targetLanguageId,
                  },
                  i18n.resolvedLanguage ?? i18n.language,
                  (key, options) => t(`deck.type.${key}`, options),
                )}{' '}
                · {deck.cardCount} cards · by @{deck.owner.username}
              </Text>
              {deck.description ? <Text>{deck.description}</Text> : null}
            </View>

            {done ? (
              <View className="items-center gap-2">
                <Text className="text-center text-muted-foreground">
                  {done}
                </Text>
                {awaitingSync && (
                  <Button
                    variant="outline"
                    className="h-12 sm:h-12"
                    loading={pending === 'import'}
                    onPress={() => run('import', bringHome)}
                  >
                    <Text>Retry sync</Text>
                  </Button>
                )}
              </View>
            ) : reporting ? (
              <View className="gap-2">
                <Text className="font-semibold">Report this deck</Text>
                <TextInput
                  className="min-h-12 rounded-md border border-input bg-background px-3 py-2 text-foreground"
                  placeholder="What is wrong with it?"
                  placeholderTextColor="#888"
                  accessibilityLabel="Reason"
                  value={reason}
                  onChangeText={setReason}
                  multiline
                />
                <View className="flex-row gap-2">
                  <Button
                    variant="secondary"
                    className="h-12 flex-1 sm:h-12"
                    disabled={pending !== null}
                    onPress={() => setReporting(false)}
                  >
                    <Text>Cancel</Text>
                  </Button>
                  <Button
                    variant="destructive"
                    className="h-12 flex-1 sm:h-12"
                    disabled={reason.trim().length === 0}
                    loading={pending === 'report'}
                    onPress={() =>
                      run('report', async () => {
                        await apiClient.sharedDecks.report(id, reason.trim());
                        setReporting(false);
                        setDone('Thanks, the deck is reported.');
                      })
                    }
                  >
                    <Text>Send report</Text>
                  </Button>
                </View>
              </View>
            ) : (
              <View className="flex-row gap-2">
                <Button
                  variant="outline"
                  className="h-12 flex-1 sm:h-12"
                  disabled={pending !== null}
                  onPress={() => setReporting(true)}
                >
                  <Text>Report</Text>
                </Button>
                <Button
                  className="h-12 flex-1 sm:h-12"
                  loading={pending === 'import'}
                  disabled={pending !== null}
                  onPress={() =>
                    run('import', async () => {
                      // The copy lands in the importer's account on the server; the
                      // sync brings it to the device.
                      await apiClient.sharedDecks.import(id);
                      await bringHome();
                    })
                  }
                >
                  <Text>Import</Text>
                </Button>
              </View>
            )}

            <View role="list" className="gap-3">
              {deck.cards.map((card, index) => (
                <Card key={index} role="listitem">
                  <CardHeader>
                    <CardTitle>
                      <Markdown content={card.front} inline />
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {/* Inline Markdown takes its colour from the text
                        around it, as in the card list. */}
                    <Text className="text-sm text-muted-foreground">
                      <Markdown content={card.back} inline />
                    </Text>
                  </CardContent>
                </Card>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </RequireSession>
  );
}
