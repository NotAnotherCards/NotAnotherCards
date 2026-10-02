import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import type { ModerationWarning, OwnerModerationStatus } from '@repo/schemas';
import type { UserCardRecord, UserDeckRecord } from '@repo/offline-db';
import { useSessionDatabase } from '@/lib/database-provider';
import { syncFailure } from '@/lib/sync-outcome';
import { apiClient } from '@/lib/api-client';
import { useModerationExplanation } from '@repo/api-client/react';
import { Button } from './ui/button';
import { Text } from './ui/text';

// Publish and unpublish, as web's deck page offers them. Publishing
// syncs first so the server moderates the latest cards, then syncs again
// so the visibility comes back; a refusal names the flagged cards, a
// publish with warnings lists them, and a deck blocked later shows why.
// The deck and its cards come from the card list, which already has them.
export function PublishPanel({
  deck,
  cards,
}: {
  deck: Pick<UserDeckRecord, 'id' | 'visibility'>;
  cards: readonly Pick<UserCardRecord, 'id' | 'front'>[];
}) {
  const deckId = deck.id;
  const { manager, syncController } = useSessionDatabase();
  const [status, setStatus] = useState<OwnerModerationStatus>({
    status: 'clear',
  });
  // The server's answer until the local row catches up through sync, so
  // the panel offers Unpublish right after a publish even when the sync
  // after it failed.
  const [remoteVisibility, setRemoteVisibility] = useState<
    'public' | 'private' | null
  >(null);
  useEffect(() => setRemoteVisibility(null), [deck.visibility]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flagged, setFlagged] = useState<ModerationWarning[]>([]);
  const [warnings, setWarnings] = useState<ModerationWarning[]>([]);
  // "Why?" streams one explanation at a time, as web's deck page does;
  // a refusal is about the working cards, a takedown or warning about the
  // published snapshot. Leaving the screen cancels the stream.
  const explanation = useModerationExplanation(apiClient, deckId);
  const finding = (
    item: ModerationWarning,
    index: number,
    source: 'working' | 'published',
    tone: 'destructive' | 'muted',
    prefix = '',
  ) => {
    // Which finding: its card and reason, as web keys them. A position would
    // be reused by a different finding after the next publish attempt.
    const key = `${source}:${item.cardId}:${item.reason}`;
    const isActive = explanation.activeKey === key;
    return (
      <View key={`${key}:${index}`} className="gap-1">
        <View className="flex-row items-center justify-between gap-2">
          <Text
            className={`shrink text-sm ${tone === 'destructive' ? 'text-destructive' : 'text-muted-foreground'}`}
          >
            {prefix}
            {cardName(item.cardId)}: {item.reason}
          </Text>
          <Button
            variant="ghost"
            size="sm"
            className="h-12 sm:h-12"
            accessibilityLabel={`Why was ${cardName(item.cardId)} flagged?`}
            disabled={isActive && explanation.isLoading}
            onPress={() => void explanation.explain(key, item, source)}
          >
            <Text>Why?</Text>
          </Button>
        </View>
        {isActive && explanation.text ? (
          <Text className="text-sm">{explanation.text}</Text>
        ) : null}
        {isActive && explanation.isLoading && !explanation.text ? (
          <Text className="text-sm text-muted-foreground">Asking…</Text>
        ) : null}
        {isActive && explanation.error ? (
          <Text className="text-sm text-destructive">{explanation.error}</Text>
        ) : null}
      </View>
    );
  };

  // Supplemental to the offline deck: offline, the panel simply has no
  // moderation status to show.
  const statusRequest = useRef(0);
  const mounted = useRef(false);
  const refreshStatus = useCallback(async () => {
    if (!mounted.current) return;
    const request = ++statusRequest.current;
    try {
      const next = await apiClient.publishing.moderationStatus(deckId);
      if (request === statusRequest.current) setStatus(next);
    } catch {
      // stays as it was
    }
  }, [deckId]);
  useEffect(() => {
    mounted.current = true;
    void refreshStatus();
    return () => {
      mounted.current = false;
      ++statusRequest.current;
    };
  }, [refreshStatus]);

  const isPublic =
    (remoteVisibility ?? deck.visibility) === 'public' &&
    status.status !== 'blocked';
  const cardName = (cardId: string) =>
    cards.find((card) => card.id === cardId)?.front ?? 'A card';

  // The sync before the call uploads the latest cards, so moderation sees
  // them; if it did not go through, nothing is sent. The sync after it
  // brings the visibility back; a failure there leaves the server's
  // result in place and says the device catches up later. Work that
  // changed nothing on the server (a refusal) ends the sequence there.
  const scope = manager ? { db: manager.database, deckId } : undefined;
  const run = async (work: () => Promise<'changed' | 'refused'>) => {
    setError(null);
    setFlagged([]);
    explanation.clear();
    setPending(true);
    try {
      const notSynced = await syncFailure(
        await syncController?.syncNow(),
        scope,
      );
      if (notSynced) {
        setError(`Not sent: ${notSynced}`);
        return;
      }
      if ((await work()) === 'refused') return;
      const behind = await syncFailure(await syncController?.syncNow(), scope);
      if (behind) {
        setError(
          `Done on the server; this device catches up at the next sync. ${behind}`,
        );
      }
      await refreshStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The request failed');
    } finally {
      setPending(false);
    }
  };

  const shownWarnings =
    warnings.length > 0
      ? warnings
      : status.status === 'visible'
        ? status.warnings
        : [];

  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between gap-2">
        <Text className="text-sm text-muted-foreground">
          {status.status === 'blocked'
            ? 'Taken down by moderation'
            : isPublic
              ? 'Published to the community'
              : 'Private'}
        </Text>
        {isPublic ? (
          <Button
            variant="outline"
            className="h-12 sm:h-12"
            loading={pending}
            onPress={() =>
              run(async () => {
                await apiClient.publishing.unpublish(deckId);
                ++statusRequest.current;
                setWarnings([]);
                setRemoteVisibility('private');
                // The server's answer is the status until a refresh says
                // otherwise; a failed refresh must not bring back an old one.
                setStatus({ status: 'clear' });
                return 'changed';
              })
            }
          >
            <Text>Unpublish</Text>
          </Button>
        ) : (
          <Button
            variant="secondary"
            className="h-12 sm:h-12"
            loading={pending}
            onPress={() =>
              run(async () => {
                const outcome = await apiClient.publishing.publish(deckId);
                ++statusRequest.current;
                if (outcome.published) {
                  setWarnings(outcome.warnings);
                  setRemoteVisibility('public');
                  setStatus({ status: 'visible', warnings: outcome.warnings });
                  return 'changed';
                }
                setFlagged(outcome.refusal.flagged);
                setError(
                  outcome.refusal.reason ??
                    (outcome.refusal.flagged.length > 0
                      ? 'Moderation refused the deck. Review the flagged cards and try again.'
                      : 'Moderation refused the deck.'),
                );
                return 'refused';
              })
            }
          >
            <Text>Publish</Text>
          </Button>
        )}
      </View>
      {error && <Text className="text-destructive">{error}</Text>}
      {flagged.map((item, index) =>
        finding(item, index, 'working', 'destructive'),
      )}
      {/* An operator takedown carries only a reason, no flagged cards. */}
      {status.status === 'blocked' && status.reason && (
        <Text className="text-sm text-destructive">{status.reason}</Text>
      )}
      {status.status === 'blocked' &&
        status.flagged.map((item, index) =>
          finding(item, index, 'published', 'destructive'),
        )}
      {shownWarnings.map((item, index) =>
        finding(item, index, 'published', 'muted', 'Warning, '),
      )}
    </View>
  );
}
