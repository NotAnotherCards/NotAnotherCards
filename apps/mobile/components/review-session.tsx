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
  BASIC_NOTE_TYPE,
  WORD_NOTE_TYPE,
  selectReviewBatch,
  type ReviewAnswer,
  type ReviewPreferences,
  type UserCardRecord,
} from '@repo/offline-db';
import { authClient } from '@/lib/auth-client';
import { useSessionDatabase } from '@/lib/database-provider';
import { writeErrorMessage } from '@/lib/errors';
import {
  loadReviewPreferences,
  saveReviewPreferences,
} from '@/lib/review-preferences';
import { useCards, type Card as CardRecord } from '@/lib/cards';
import { useReviewDeck } from '@/lib/review';
import { CardEditor } from './card-editor';
import { PencilIcon, PlusIcon } from './ui/icon';
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

// One hue per answer, the dark: border too because outline sets its own.
const answerColours: Record<ReviewAnswer, { button: string; text: string }> = {
  forgot: {
    button: 'border-rating-again/40 dark:border-rating-again/40',
    text: 'text-rating-again',
  },
  hard: {
    button: 'border-rating-hard/40 dark:border-rating-hard/40',
    text: 'text-rating-hard',
  },
  remember: {
    button: 'border-rating-good/40 dark:border-rating-good/40',
    text: 'text-rating-good',
  },
  'very-easy': {
    button: 'border-rating-easy/40 dark:border-rating-easy/40',
    text: 'text-rating-easy',
  },
};

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
    />
  );
}

// A long press on an answer steps through the three layouts. Basic with
// intervals, which settings allow, joins at basic and never comes back
// from the cycle: two answers do not need the extra line.
function nextLayout(preferences: ReviewPreferences): ReviewPreferences {
  if (preferences.reviewMode === 'basic') {
    return { reviewMode: 'extended', showNextReviewInterval: false };
  }
  if (!preferences.showNextReviewInterval) {
    return { reviewMode: 'extended', showNextReviewInterval: true };
  }
  return { reviewMode: 'basic', showNextReviewInterval: false };
}

const layoutNames = (preferences: ReviewPreferences) =>
  preferences.reviewMode === 'basic'
    ? 'Two answers'
    : preferences.showNextReviewInterval
      ? 'Four answers with intervals'
      : 'Four answers';

function ActiveReviewSession({
  manager,
  deckId,
  userId,
}: {
  manager: DatabaseManager;
  deckId: string;
  userId: string;
}) {
  // Held here, not read once: the long press changes it mid-session, and
  // saving it keeps settings and the next review in step.
  const [preferences, setPreferences] = useState(() =>
    loadReviewPreferences(userId),
  );
  const [layoutHint, setLayoutHint] = useState<string | null>(null);
  useEffect(() => {
    if (!layoutHint) return;
    const timer = setTimeout(() => setLayoutHint(null), 2000);
    return () => clearTimeout(timer);
  }, [layoutHint]);
  const switchLayout = () => {
    const next = nextLayout(preferences);
    setPreferences(next);
    if (userId) saveReviewPreferences(userId, next);
    setLayoutHint(layoutNames(next));
  };
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
  // Answers given so far, for progress across batches.
  const [answered, setAnswered] = useState(0);
  // The card editor over the review: a new card, or the current one.
  const [editing, setEditing] = useState<
    { kind: 'new' } | { kind: 'edit'; card: CardRecord } | null
  >(null);
  const editor = useCards(manager, deckId);

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
      setAnswered((count) => count + 1);
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

  // The editor replaces the card until it is saved or cancelled; the
  // session keeps its place, and an edit shows on the same card.
  if (editing && editor.deck && editor.writes) {
    const editCard = editing.kind === 'edit' ? editing.card : undefined;
    return (
      <View className="gap-4">
        <Stack.Screen options={{ title: deck.title }} />
        <CardEditor
          deck={editor.deck}
          card={editCard}
          note={editCard ? editor.noteForCard(editCard) : null}
          writes={editor.writes}
          onDone={() => setEditing(null)}
          // The deleted card is gone from the deck: move on as after an
          // answer, without counting it as one.
          onDeleted={() => {
            setEditing(null);
            setIsFlipped(false);
            void advance();
          }}
        />
      </View>
    );
  }

  const isWordDeck = deck.note_type === WORD_NOTE_TYPE;
  const canAdd = isWordDeck || deck.note_type === BASIC_NOTE_TYPE;
  const edit = () => {
    if (editor.canEdit(card)) setEditing({ kind: 'edit', card });
  };
  // Answered, plus every card still due: the live query drops a card once
  // it is answered and brings it back if it falls due again.
  const total = answered + dueCards.length;

  return (
    <View className="flex-1 gap-4">
      <Stack.Screen options={{ title: deck.title }} />
      {/* Leaving is the header's back arrow, so this row keeps the
          progress and the two writes web's review offers. */}
      <View className="flex-row items-center justify-between">
        <Text className="text-sm font-semibold text-muted-foreground">
          {answered + 1} of {total}
        </Text>
        <View className="flex-row gap-1">
          {editor.canEdit(card) && (
            <Button
              variant="ghost"
              size="icon"
              accessibilityLabel="Edit this card"
              disabled={isSaving}
              onPress={edit}
            >
              <PencilIcon size={18} className="text-muted-foreground" />
            </Button>
          )}
          {canAdd && (
            <Button
              variant="ghost"
              size="icon"
              accessibilityLabel={isWordDeck ? 'Add a word' : 'Add a card'}
              disabled={isSaving}
              onPress={() => setEditing({ kind: 'new' })}
            >
              <PlusIcon size={20} className="text-muted-foreground" />
            </Button>
          )}
        </View>
      </View>

      {/* Tapping the card toggles: read the answer, tap again for the
          question. "Show answer" only reveals. A long press edits, the
          pencil's shortcut; screen readers get it as an action. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isFlipped ? 'Show the question' : 'Show the answer'}
        accessibilityActions={
          editor.canEdit(card)
            ? [{ name: 'edit', label: 'Edit this card' }]
            : []
        }
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'edit') edit();
        }}
        disabled={isSaving}
        onPress={() => setIsFlipped((flipped) => !flipped)}
        onLongPress={edit}
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

      {/* The card reads from the top, the controls stay at the bottom. */}
      <View className="flex-1" />

      {saveError ? (
        <Text className="text-center text-destructive">{saveError}</Text>
      ) : null}

      {layoutHint && (
        <Text className="text-center text-sm text-muted-foreground">
          {layoutHint}
        </Text>
      )}

      {!isFlipped ? (
        <Button variant="outline" onPress={() => setIsFlipped(true)}>
          <Text>Show answer</Text>
        </Button>
      ) : (
        <View className="flex-row gap-2">
          {answers.map((answer) => (
            <Button
              key={answer}
              variant="outline"
              // One row: four buttons are narrow, so the interval sits
              // under the label and h-auto lets the button grow for it.
              className={`h-auto flex-1 flex-col gap-0.5 px-1 py-2 ${answerColours[answer].button}`}
              disabled={isSaving}
              onPress={() => void record(answer)}
              // Held a little longer than the default, so a slow answer
              // is not taken for a layout switch. Never records a rating.
              delayLongPress={600}
              onLongPress={switchLayout}
              accessibilityActions={[
                {
                  name: 'layout',
                  label: `Switch to ${layoutNames(nextLayout(preferences)).toLowerCase()}`,
                },
              ]}
              onAccessibilityAction={(event) => {
                if (event.nativeEvent.actionName === 'layout') switchLayout();
              }}
            >
              <Text className={answerColours[answer].text}>
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
