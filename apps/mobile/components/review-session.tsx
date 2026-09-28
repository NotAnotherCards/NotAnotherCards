import { useEffect, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, View } from 'react-native';
import type { DatabaseManager } from '@remelondb/core';
import {
  calculateReviewIntervalMinutes,
  extendedReviewAnswerLabels,
  formatReviewInterval,
  reviewAnswerLabels,
  reviewRatingByAnswer,
  selectReviewBatch,
  type ReviewAnswer,
  type ReviewPreferences,
  type UserCardRecord,
} from '@repo/offline-db';
import { authClient } from '@/lib/auth-client';
import { useSessionDatabase } from '@/lib/database-provider';
import { writeErrorMessage } from '@/lib/errors';
import {
  loadActivationCount,
  loadReviewPreferences,
  saveActivationCount,
  saveLastReviewDeckId,
} from '@/lib/review-preferences';
import { useReviewDeck } from '@/lib/review';
import { cardsForDeck } from '@/lib/cards-in-deck';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader } from './ui/card';
import { Input } from './ui/input';
import { Markdown } from './ui/markdown';
import { Text } from './ui/text';
import { useTranslation } from 'react-i18next';
import { WORD_NOTE_TYPE } from '@repo/offline-db';

type ReviewBatch = {
  deckId: string;
  cards: UserCardRecord[];
  remaining: UserCardRecord[];
};

function ActivationControls({
  count,
  onChangeCount,
  onActivate,
  isActivating,
  error,
  inactiveItemCount,
  itemLabel,
}: {
  count: string;
  onChangeCount: (value: string) => void;
  onActivate: () => void;
  isActivating: boolean;
  error: string | null;
  inactiveItemCount: number;
  itemLabel: 'words' | 'cards';
}) {
  const { t } = useTranslation();
  const selectedCount = Math.min(
    inactiveItemCount,
    Math.max(1, Math.floor(Number(count) || 5)),
  );
  return (
    <>
      <Text>{t('review.activation.activate', 'Activate')}</Text>
      <Input
        value={String(selectedCount)}
        onChangeText={onChangeCount}
        keyboardType="number-pad"
        accessibilityLabel={t(
          'review.activation.count_label',
          'Number of items to activate',
        )}
        className="w-20 text-center"
      />
      <Text>
        {itemLabel === 'cards'
          ? t(
              inactiveItemCount === 1
                ? 'review.activation.more_card'
                : 'review.activation.more_cards',
              { count: inactiveItemCount },
            )
          : t(
              inactiveItemCount === 1
                ? 'review.activation.more_word'
                : 'review.activation.more_words',
              { count: inactiveItemCount },
            )}
      </Text>
      <Button onPress={onActivate} disabled={isActivating}>
        <Text>{t('review.activation.continue', 'Activate and continue')}</Text>
      </Button>
      {error && <Text className="text-destructive">{error}</Text>}
    </>
  );
}

// Web's two modes, same labels: basic asks whether you knew it, extended
// keeps the four scheduler ratings apart. Settings stores the choice.
const BASIC_ANSWERS: ReviewAnswer[] = ['forgot', 'remember'];
const EXTENDED_ANSWERS: ReviewAnswer[] = [
  'forgot',
  'hard',
  'remember',
  'very-easy',
];

function makeBatch(deckId: string, cards: UserCardRecord[]): ReviewBatch {
  const batch = selectReviewBatch(cards);
  const selectedIds = new Set(batch.map((card) => card.id));
  return {
    deckId,
    cards: batch,
    remaining: cards.filter((card) => !selectedIds.has(card.id)),
  };
}

export function ReviewSession({ deckId }: { deckId: string }) {
  const { manager } = useSessionDatabase();
  const { data: authSession } = authClient.useSession();
  if (!manager) {
    return (
      <View className="items-center py-12">
        <ActivityIndicator />
      </View>
    );
  }
  return (
    <ActiveReviewSession
      manager={manager}
      deckId={deckId}
      userId={authSession?.user.id ?? ''}
      preferences={loadReviewPreferences(authSession?.user.id ?? '')}
    />
  );
}

function ActiveReviewSession({
  manager,
  deckId,
  userId,
  preferences,
}: {
  manager: DatabaseManager;
  deckId: string;
  userId: string;
  preferences: ReviewPreferences;
}) {
  const { t } = useTranslation();
  const answers =
    preferences.reviewMode === 'extended' ? EXTENDED_ANSWERS : BASIC_ANSWERS;
  const router = useRouter();
  const { deck, dueCards, memberships, cards, isLoading, error, writes } =
    useReviewDeck(manager, deckId);
  const [session, setSession] = useState<ReviewBatch | null>(null);
  const [cardIndex, setCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [activationCount, setActivationCount] = useState('5');
  const [activationPending, setActivationPending] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [activationError, setActivationError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && deck && activationPending) {
      setSession(makeBatch(deckId, dueCards));
      setCardIndex(0);
      setIsComplete(false);
      setActivationPending(false);
    } else if (
      !isLoading &&
      deck &&
      (session?.deckId !== deckId ||
        (session?.cards.length === 0 && dueCards.length > 0))
    ) {
      setSession(makeBatch(deckId, dueCards));
      setCardIndex(0);
      setIsFlipped(false);
      setSaveError(null);
      setIsComplete(false);
    }
  }, [activationPending, deck, deckId, dueCards, isLoading, session?.deckId]);

  useEffect(() => {
    setActivationCount(String(loadActivationCount(userId)));
  }, [userId]);

  useEffect(() => {
    if (deck && userId) saveLastReviewDeckId(userId, deck.id);
  }, [deck, userId]);

  if (isLoading || !writes) {
    return (
      <View className="items-center py-12">
        <ActivityIndicator />
      </View>
    );
  }

  if (error) {
    return (
      <View className="gap-4 py-8">
        <Text className="text-center text-destructive">
          {t('review.recovery.load_error', { message: error.message })}
        </Text>
        <Button variant="outline" onPress={() => router.back()}>
          <Text>{t('review.recovery.back_to_deck', 'Back to deck')}</Text>
        </Button>
      </View>
    );
  }

  if (!deck) {
    return (
      <View className="gap-4 py-8">
        <Text className="text-center font-semibold">
          {t('review.recovery.deck_not_found_title', 'Deck not found')}
        </Text>
        <Button variant="outline" onPress={() => router.back()}>
          <Text>{t('review.recovery.back', 'Back')}</Text>
        </Button>
      </View>
    );
  }

  if (session?.deckId !== deckId) {
    return (
      <View className="items-center py-12">
        <ActivityIndicator />
      </View>
    );
  }

  const card = session.cards[cardIndex];
  const deckCards = cardsForDeck(memberships, cards, deckId);
  const isWordDeck = deck.note_type === WORD_NOTE_TYPE;
  const inactiveItemCount = isWordDeck
    ? new Set(
        deckCards.filter((item) => !item.active).map((item) => item.note_id),
      ).size
    : deckCards.filter((item) => !item.active).length;
  const activationItemLabel = isWordDeck ? 'words' : 'cards';
  const activateMore = async () => {
    if (isActivating) return;
    const count = Math.min(
      inactiveItemCount,
      Math.max(1, Math.floor(Number(activationCount) || 5)),
    );
    setIsActivating(true);
    setActivationError(null);
    try {
      await writes.activate(deckId, count);
      saveActivationCount(userId, count);
      setSession(null);
      setActivationPending(true);
    } catch {
      setActivationError(
        t('review.activation.error', 'Activation error. Try again.'),
      );
    } finally {
      setIsActivating(false);
    }
  };
  const advance = () => {
    if (cardIndex < session.cards.length - 1) {
      setCardIndex((index) => index + 1);
      return;
    }

    const next = makeBatch(deckId, session.remaining);
    if (next.cards.length > 0) {
      setSession(next);
      setCardIndex(0);
      return;
    }
    setIsComplete(true);
  };

  const record = async (answer: ReviewAnswer) => {
    if (!card || !isFlipped || isSaving) return;
    setSaveError(null);
    setIsSaving(true);
    try {
      await writes.record(card.id, reviewRatingByAnswer[answer]);
      setIsFlipped(false);
      advance();
    } catch (cause) {
      setSaveError(writeErrorMessage(cause, 'Could not save your answer'));
    } finally {
      setIsSaving(false);
    }
  };

  const leave = () => router.replace(`/deck/${deckId}`);

  if (isComplete) {
    return (
      <View className="items-center gap-4 py-12">
        <Stack.Screen options={{ title: deck.title }} />
        <Text className="text-2xl font-semibold">
          {t('review.activation.complete_title', 'Review complete')}
        </Text>
        <Text className="text-center text-muted-foreground">
          {t(
            'review.activation.complete_description',
            'All due cards in this deck are done for now.',
          )}
        </Text>
        {inactiveItemCount > 0 && (
          <ActivationControls
            count={activationCount}
            onChangeCount={setActivationCount}
            onActivate={() => void activateMore()}
            isActivating={isActivating}
            error={activationError}
            inactiveItemCount={inactiveItemCount}
            itemLabel={activationItemLabel}
          />
        )}
        <Button onPress={leave}>
          <Text>{t('review.recovery.back_to_deck', 'Back to deck')}</Text>
        </Button>
      </View>
    );
  }

  if (!card) {
    return (
      <View className="items-center gap-4 py-12">
        <Stack.Screen options={{ title: deck.title }} />
        <Text className="text-2xl font-semibold">
          {t('review.recovery.no_cards_due_title', 'No cards due')}
        </Text>
        <Text className="text-center text-muted-foreground">
          {t('review.recovery.no_cards_due', { title: deck.title })}
        </Text>
        {inactiveItemCount > 0 && (
          <ActivationControls
            count={activationCount}
            onChangeCount={setActivationCount}
            onActivate={() => void activateMore()}
            isActivating={isActivating}
            error={activationError}
            inactiveItemCount={inactiveItemCount}
            itemLabel={activationItemLabel}
          />
        )}
        <Button onPress={leave}>
          <Text>{t('review.recovery.back_to_deck', 'Back to deck')}</Text>
        </Button>
      </View>
    );
  }

  return (
    <View className="gap-4">
      <Stack.Screen options={{ title: deck.title }} />
      <View className="flex-row items-center justify-between">
        <Text className="text-sm font-semibold text-muted-foreground">
          Card {cardIndex + 1} of {session.cards.length}
        </Text>
        <Button variant="ghost" size="sm" onPress={leave} disabled={isSaving}>
          <Text>Exit review</Text>
        </Button>
      </View>

      {/* Tapping the card toggles: read the answer, tap again for the
          question. "Show answer" only reveals. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isFlipped ? 'Show the question' : 'Show the answer'}
        disabled={isSaving}
        onPress={() => setIsFlipped((flipped) => !flipped)}
      >
        <Card className="min-h-80 justify-center">
          <CardHeader>
            <Text className="text-center text-xs font-semibold uppercase text-muted-foreground">
              {isFlipped ? 'Answer' : 'Question'}
            </Text>
          </CardHeader>
          <CardContent>
            <Markdown content={isFlipped ? card.back : card.front} />
          </CardContent>
        </Card>
      </Pressable>

      {saveError ? (
        <Text className="text-center text-destructive">{saveError}</Text>
      ) : null}

      {!isFlipped ? (
        <Button variant="outline" onPress={() => setIsFlipped(true)}>
          <Text>Show answer</Text>
        </Button>
      ) : (
        <View className="flex-row flex-wrap gap-2">
          {answers.map((answer) => (
            <Button
              key={answer}
              variant="outline"
              className="min-w-[45%] flex-1 flex-col gap-0"
              disabled={isSaving}
              onPress={() => void record(answer)}
            >
              <Text>
                {preferences.reviewMode === 'extended'
                  ? extendedReviewAnswerLabels[answer]
                  : reviewAnswerLabels[answer]}
              </Text>
              {preferences.showNextReviewInterval && (
                <Text className="text-xs text-muted-foreground">
                  {formatReviewInterval(
                    calculateReviewIntervalMinutes(
                      card.scheduled_interval_minutes,
                      reviewRatingByAnswer[answer],
                    ),
                  )}
                </Text>
              )}
            </Button>
          ))}
        </View>
      )}
    </View>
  );
}
