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
import { loadReviewPreferences } from '@/lib/review-preferences';
import { useReviewDeck } from '@/lib/review';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader } from './ui/card';
import { Markdown } from './ui/markdown';
import { Text } from './ui/text';

type ReviewBatch = {
  deckId: string;
  cards: UserCardRecord[];
  remaining: UserCardRecord[];
};

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
      preferences={loadReviewPreferences(authSession?.user.id ?? '')}
    />
  );
}

function ActiveReviewSession({
  manager,
  deckId,
  preferences,
}: {
  manager: DatabaseManager;
  deckId: string;
  preferences: ReviewPreferences;
}) {
  const answers =
    preferences.reviewMode === 'extended' ? EXTENDED_ANSWERS : BASIC_ANSWERS;
  const router = useRouter();
  const { deck, dueCards, isLoading, error, writes } = useReviewDeck(
    manager,
    deckId,
  );
  const [session, setSession] = useState<ReviewBatch | null>(null);
  const [cardIndex, setCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (!isLoading && deck && session?.deckId !== deckId) {
      setSession(makeBatch(deckId, dueCards));
      setCardIndex(0);
      setIsFlipped(false);
      setSaveError(null);
      setIsComplete(false);
    }
  }, [deck, deckId, dueCards, isLoading, session?.deckId]);

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
          Failed to load this review: {error.message}
        </Text>
        <Button variant="outline" onPress={() => router.back()}>
          <Text>Back to deck</Text>
        </Button>
      </View>
    );
  }

  if (!deck) {
    return (
      <View className="gap-4 py-8">
        <Text className="text-center font-semibold">Deck not found</Text>
        <Button variant="outline" onPress={() => router.back()}>
          <Text>Back</Text>
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
        <Text className="text-2xl font-semibold">Review complete</Text>
        <Text className="text-center text-muted-foreground">
          All due cards in this deck are done for now.
        </Text>
        <Button onPress={leave}>
          <Text>Back to deck</Text>
        </Button>
      </View>
    );
  }

  if (!card) {
    return (
      <View className="items-center gap-4 py-12">
        <Stack.Screen options={{ title: deck.title }} />
        <Text className="text-2xl font-semibold">No cards due</Text>
        <Text className="text-center text-muted-foreground">
          There are no cards due in {deck.title} right now.
        </Text>
        <Button onPress={leave}>
          <Text>Back to deck</Text>
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
