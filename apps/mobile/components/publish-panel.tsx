import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import type { ModerationWarning, OwnerModerationStatus } from '@repo/schemas';
import type { UserCardRecord, UserDeckRecord } from '@repo/offline-db';
import { useSessionDatabase } from '@/lib/database-provider';
import { syncFailure } from '@/lib/sync-outcome';
import { apiClient } from '@/lib/api-client';
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
  // "Why?" streams an explanation per card, as web's deck page does; a
  // refusal is about the working cards, a takedown or warning about the
  // published snapshot. Leaving the screen cancels the stream.
  type Explanation = { text: string; pending: boolean; error: string | null };
  const [explanations, setExplanations] = useState<Record<string, Explanation>>(
    {},
  );
  const explaining = useRef<{
    cardId: string;
    controller: AbortController;
  } | null>(null);
  useEffect(() => () => explaining.current?.controller.abort(), []);
  const patch = (
    cardId: string,
    change: (was: Explanation) => Partial<Explanation>,
  ) =>
    setExplanations((all) => {
      const was = all[cardId] ?? { text: '', pending: false, error: null };
      return { ...all, [cardId]: { ...was, ...change(was) } };
    });
  const explain = async (
    finding: ModerationWarning,
    source: 'working' | 'published',
  ) => {
    // One stream at a time: the card asked before gives up its request and
    // its button comes back.
    if (explaining.current) {
      explaining.current.controller.abort();
      patch(explaining.current.cardId, () => ({ pending: false }));
    }
    const controller = new AbortController();
    explaining.current = { cardId: finding.cardId, controller };
    patch(finding.cardId, () => ({ text: '', pending: true, error: null }));
    try {
      const text = await apiClient.publishing.explain(
        deckId,
        { cardId: finding.cardId, reason: finding.reason, source },
        (delta) => {
          if (!controller.signal.aborted)
            patch(finding.cardId, (was) => ({ text: was.text + delta }));
        },
        { signal: controller.signal },
      );
      if (!controller.signal.aborted)
        patch(finding.cardId, () => ({ text, pending: false }));
    } catch (err) {
      if (controller.signal.aborted) return;
      patch(finding.cardId, () => ({
        pending: false,
        error: err instanceof Error ? err.message : 'No explanation.',
      }));
    }
  };
  const finding = (
    item: ModerationWarning,
    source: 'working' | 'published',
    tone: 'destructive' | 'muted',
    prefix = '',
  ) => {
    const explanation = explanations[item.cardId];
    return (
      <View key={item.cardId} className="gap-1">
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
            disabled={explanation?.pending}
            onPress={() => void explain(item, source)}
          >
            <Text>Why?</Text>
          </Button>
        </View>
        {explanation?.text ? (
          <Text className="text-sm">{explanation.text}</Text>
        ) : null}
        {explanation?.pending && !explanation.text ? (
          <Text className="text-sm text-muted-foreground">Asking…</Text>
        ) : null}
        {explanation?.error ? (
          <Text className="text-sm text-destructive">{explanation.error}</Text>
        ) : null}
      </View>
    );
  };

  // Supplemental to the offline deck: offline, the panel simply has no
  // moderation status to show.
  const refreshStatus = async () => {
    try {
      setStatus(await apiClient.publishing.moderationStatus(deckId));
    } catch {
      // stays as it was
    }
  };
  useEffect(() => {
    apiClient.publishing
      .moderationStatus(deckId)
      .then(setStatus)
      .catch(() => {});
  }, [deckId]);

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
      {flagged.map((item) => finding(item, 'working', 'destructive'))}
      {/* An operator takedown carries only a reason, no flagged cards. */}
      {status.status === 'blocked' && status.reason && (
        <Text className="text-sm text-destructive">{status.reason}</Text>
      )}
      {status.status === 'blocked' &&
        status.flagged.map((item) => finding(item, 'published', 'destructive'))}
      {shownWarnings.map((item) =>
        finding(item, 'published', 'muted', 'Warning, '),
      )}
    </View>
  );
}
