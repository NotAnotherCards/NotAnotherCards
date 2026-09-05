import { useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, View } from 'react-native';
import type { DatabaseManager } from '@remelondb/core';
import { calculateReviewIntervalMinutes } from '@repo/offline-db';
import { useSessionDatabase } from '@/lib/database-provider';
import { useCards, type Card as CardRecord } from '@/lib/cards';
import { writeErrorMessage } from '@/lib/errors';
import {
  RATINGS,
  RATING_LABELS,
  formatReviewInterval,
} from '@/lib/review-ratings';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Text } from './ui/text';

// Readiness gate, as CardList: no manager yet means no database to query.
export function FlashcardView({ deckId }: { deckId: string }) {
  const { manager } = useSessionDatabase();
  if (!manager) {
    return (
      <View className="items-center py-6">
        <ActivityIndicator />
      </View>
    );
  }
  return <ActiveFlashcardView manager={manager} deckId={deckId} />;
}

function ActiveFlashcardView({
  manager,
  deckId,
}: {
  manager: DatabaseManager;
  deckId: string;
}) {
  const router = useRouter();
  const { deck, cards, isLoading, error, writes } = useCards(manager, deckId);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [writeError, setWriteError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (isLoading || !writes) {
    return (
      <View className="items-center py-6">
        <ActivityIndicator />
      </View>
    );
  }

  if (error) {
    return (
      <Text className="text-destructive">
        Failed to load cards: {error.message}
      </Text>
    );
  }

  if (!deck) {
    return (
      <Text className="text-muted-foreground">
        This deck is not on this device.
      </Text>
    );
  }

  if (cards.length === 0) {
    return (
      <View className="gap-4">
        <Stack.Screen options={{ title: deck.title }} />
        <Text className="text-muted-foreground">
          This deck has no cards yet. Add one to start reviewing.
        </Text>
      </View>
    );
  }

  // The index survives a card leaving the deck mid-session, so clamp rather
  // than trust it. cards is non-empty here, so the card always exists.
  const position = Math.min(index, cards.length - 1);
  const card = cards[position] as CardRecord;

  // Moving on always shows a front: a back with the next card's answer
  // already revealed is the one thing this screen must never do.
  const goTo = (next: number) => {
    setWriteError(null);
    setFlipped(false);
    setIndex(((next % cards.length) + cards.length) % cards.length);
  };

  const rate = async (rating: number) => {
    if (pending) return;
    setWriteError(null);
    setPending(true);
    try {
      await writes.recordReview(card.id, rating);
      setPending(false);
      // Last card of a single-card deck: nothing left to advance to.
      if (cards.length === 1) router.back();
      else goTo(position + 1);
    } catch (err) {
      setWriteError(writeErrorMessage(err, 'The review could not be saved'));
      setPending(false);
    }
  };

  return (
    <View className="gap-4">
      <Stack.Screen options={{ title: deck.title }} />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={flipped ? 'Show the front' : 'Show the answer'}
        onPress={() => setFlipped((f) => !f)}
      >
        <Card>
          <CardContent className="min-h-56 items-center justify-center gap-3 p-8">
            <Text className="text-xs uppercase tracking-wider text-muted-foreground">
              {flipped ? 'Answer' : 'Question'}
            </Text>
            <Text className="text-center text-2xl font-semibold">
              {flipped ? card.back : card.front}
            </Text>
            {!flipped && (
              <Text className="text-xs text-muted-foreground">
                Tap the card to reveal
              </Text>
            )}
          </CardContent>
        </Card>
      </Pressable>

      {writeError && <Text className="text-destructive">{writeError}</Text>}

      {/* Ratings only once the answer is visible: rating a card you have not
          answered is not a review. Each button previews its own interval. */}
      {flipped && (
        <View className="flex-row flex-wrap gap-2">
          {RATINGS.map((rating) => (
            <Button
              key={rating}
              variant="secondary"
              className="flex-1"
              loading={pending}
              accessibilityLabel={`${RATING_LABELS[rating]}, next in ${formatReviewInterval(
                calculateReviewIntervalMinutes(
                  card.scheduled_interval_minutes,
                  rating,
                ),
              )}`}
              onPress={() => void rate(rating)}
            >
              <Text>
                {RATING_LABELS[rating]} (
                {formatReviewInterval(
                  calculateReviewIntervalMinutes(
                    card.scheduled_interval_minutes,
                    rating,
                  ),
                )}
                )
              </Text>
            </Button>
          ))}
        </View>
      )}

      {cards.length > 1 && (
        <View className="flex-row items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            disabled={pending}
            accessibilityLabel="Previous card"
            onPress={() => goTo(position - 1)}
          >
            <Text>Previous</Text>
          </Button>
          <Text className="text-sm text-muted-foreground">
            {position + 1} / {cards.length}
          </Text>
          <Button
            variant="ghost"
            size="sm"
            disabled={pending}
            accessibilityLabel="Next card"
            onPress={() => goTo(position + 1)}
          >
            <Text>Next</Text>
          </Button>
        </View>
      )}
    </View>
  );
}
