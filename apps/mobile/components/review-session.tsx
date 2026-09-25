import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  useWindowDimensions,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import type { DatabaseManager } from '@remelondb/core';
import {
  calculateReviewIntervalMinutes,
  extendedReviewAnswerLabels,
  formatReviewInterval,
  reviewAnswerLabels,
  reviewRatingByAnswer,
  BASIC_NOTE_TYPE,
  WORD_NOTE_TYPE,
  WORD_TO_TRANSLATION_TEMPLATE_KEY,
  selectReviewBatch,
  type ReviewAnswer,
  type ReviewPreferences,
  type UserCardRecord,
} from '@repo/offline-db';
import { getSwipeDirection, type ReviewSwipeDirection } from '@repo/study';

type SwipeDirection = ReviewSwipeDirection | 'very-easy';
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
import { Card } from './ui/card';
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
    | { kind: 'new' }
    | { kind: 'edit'; card: CardRecord; confirmDelete?: boolean }
    | null
  >(null);
  const editor = useCards(manager, deckId);
  // The swipe: the card follows the finger, and the direction it would
  // give shows in its header until it is let go.
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const offsetX = useSharedValue(0);
  const offsetY = useSharedValue(0);
  const [swipeDirection, setSwipeDirection] = useState<SwipeDirection | null>(
    null,
  );
  const swipeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // From a committed swipe until its answer is recorded the card is
  // leaving: buttons and gestures wait, so nothing answers it twice.
  const [isLeaving, setIsLeaving] = useState(false);
  // Once the card has flown, the screen shows what comes next as plain
  // views: the next question at full strength and no answer card, until
  // the next card is in place. Nothing then depends on when the UI thread
  // takes back the flown-off offset, which made the next question vanish
  // for a frame and come back.
  const [landedCardId, setLandedCardId] = useState<string | null>(null);
  // The space between the top row and the buttons, measured once it lays
  // out; each card takes a 3:2 index-card shape, or half the space if that
  // is smaller.
  const [cardArea, setCardArea] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const swipeHandlers = useRef<{
    update: (dx: number, dy: number) => void;
    end: (dx: number, dy: number) => void;
    cancel: () => void;
  } | null>(null);
  useEffect(
    () => () => {
      if (swipeTimer.current) clearTimeout(swipeTimer.current);
    },
    [],
  );
  useLayoutEffect(() => {
    if (!landedCardId) return;
    offsetX.value = 0;
    offsetY.value = 0;
  }, [landedCardId, offsetX, offsetY]);
  const cardMotion = useAnimatedStyle(() => ({
    transform: [
      { translateX: offsetX.value },
      { translateY: offsetY.value },
      { rotate: `${(offsetX.value / width) * 12}deg` },
    ],
  }));
  // As the answer is dragged away the question fades out over the first
  // half of the way and the next question comes in over the second, growing
  // from 95%, so the two never show at once. Complete at 60% of the width,
  // the next card is in place when the answer has flown. Without a next card
  // in this batch the question only fades to a fifth.
  // ponytail: previews within the current batch only; the next batch is read
  // when the last card is answered, so its first card cannot show here.
  const nextFront = session?.cards[cardIndex + 1]?.front ?? null;
  const questionFade = useAnimatedStyle(() => {
    const progress = Math.min(
      1,
      Math.max(Math.abs(offsetX.value), Math.abs(offsetY.value)) /
        (width * 0.6),
    );
    return {
      opacity: nextFront
        ? Math.max(0, 1 - progress * 2)
        : Math.max(0.2, 1 - progress),
    };
  });
  const nextFadeIn = useAnimatedStyle(() => {
    const progress = Math.min(
      1,
      Math.max(Math.abs(offsetX.value), Math.abs(offsetY.value)) /
        (width * 0.6),
    );
    const secondHalf = Math.max(0, progress * 2 - 1);
    return {
      opacity: secondHalf,
      transform: [{ scale: 0.95 + 0.05 * secondHalf }],
    };
  });

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

  // The batch keeps the order; the text comes from the live card, so an
  // edit made in the review shows at once.
  const batchCard = session.cards[cardIndex];
  const card =
    batchCard && (dueCards.find((due) => due.id === batchCard.id) ?? batchCard);
  // Landed until the next card replaces the answered one.
  const hasLanded = !!card && landedCardId === card.id;
  // Each move ends the landed state in the same update that shows the next
  // card, so a card answered again later is not taken for landed.
  const moveTo = (batch: ReviewBatch, index: number) => {
    setLandedCardId(null);
    if (index < batch.cards.length) {
      setSession(batch);
      setCardIndex(index);
      return;
    }

    const next = makeBatch(deckId, batch.remaining);
    if (next.cards.length > 0) {
      setSession(next);
      setCardIndex(0);
      return;
    }
    setIsComplete(true);
  };
  const advance = () => moveTo(session, cardIndex + 1);

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
      // A swiped card that could not be saved comes back to be retried.
      setLandedCardId(null);
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
          confirmDelete={editing.kind === 'edit' && editing.confirmDelete}
          onDone={() => setEditing(null)}
          // Deleting removes the whole note, so its other cards leave the
          // rest of the session too; then it moves on as after an answer,
          // without counting one.
          onDeleted={() => {
            const noteId = editCard?.note_id;
            const kept = (due: UserCardRecord) => due.note_id !== noteId;
            setEditing(null);
            setIsFlipped(false);
            moveTo(
              {
                ...session,
                cards: [
                  ...session.cards.slice(0, cardIndex),
                  ...session.cards.slice(cardIndex).filter(kept),
                ],
                remaining: session.remaining.filter(kept),
              },
              cardIndex,
            );
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

  // Web's swipe rules (@repo/study): left forgot, right remember, up hard
  // with four answers, down delete. A quarter of the screen commits; with
  // four answers, down and to the right answers easy, towards its button
  // (web has no easy swipe yet).
  const swipeMode = preferences.reviewMode === 'basic' ? 'two' : 'four';
  const swipeThreshold = width * 0.25;
  const directionFor = (dx: number, dy: number) => {
    const direction = getSwipeDirection(
      swipeMode,
      dx,
      dy,
      swipeThreshold,
      true,
    );
    // Down only means something for a card the editor can delete.
    return direction === 'delete' && !editor.canEdit(card) ? null : direction;
  };
  const settleCard = () => {
    offsetX.value = withSpring(0);
    offsetY.value = withSpring(0);
    setSwipeDirection(null);
  };
  const finishSwipe = (direction: SwipeDirection | null) => {
    if (!direction) return settleCard();
    if (direction === 'delete') {
      settleCard();
      setEditing({ kind: 'edit', card, confirmDelete: true });
      return;
    }
    setSwipeDirection(null);
    setIsLeaving(true);
    const answerNow = () => {
      setIsLeaving(false);
      setLandedCardId(card.id);
      void record(direction);
    };
    if (reduceMotion) return answerNow();
    // The card leaves the way it was thrown, then the answer is recorded.
    // The next question comes in over the same time, so this also sets how
    // fast it appears.
    const away = width * 1.5;
    const flight = 260;
    if (direction === 'hard')
      offsetY.value = withTiming(-away, { duration: flight });
    else
      offsetX.value = withTiming(direction === 'forgot' ? -away : away, {
        duration: flight,
      });
    if (direction === 'very-easy')
      offsetY.value = withTiming(away, { duration: flight });
    swipeTimer.current = setTimeout(answerNow, flight);
  };
  // The gesture calls whatever this render's handlers are, so it never acts
  // on a card or a reveal state from an earlier render.
  swipeHandlers.current = {
    update: (dx: number, dy: number) => {
      if (!isFlipped || isSaving || isLeaving) return;
      offsetX.value = dx;
      offsetY.value = dy;
      setSwipeDirection(directionFor(dx, dy));
    },
    end: (dx: number, dy: number) => {
      // A card already leaving keeps flying; only a live one settles back.
      if (isLeaving) return;
      if (!isFlipped || isSaving) return settleCard();
      finishSwipe(directionFor(dx, dy));
    },
    cancel: () => {
      if (!isLeaving) settleCard();
    },
  };
  const swipe = Gesture.Pan()
    .withTestId('review-card-swipe')
    .runOnJS(true)
    // A tap flips and a long press edits; only a real drag becomes a swipe.
    .activeOffsetX([-12, 12])
    .activeOffsetY([-12, 12])
    .onUpdate((event) =>
      swipeHandlers.current?.update(event.translationX, event.translationY),
    )
    .onEnd((event) =>
      swipeHandlers.current?.end(event.translationX, event.translationY),
    )
    .onFinalize((_event, success) => {
      if (!success) swipeHandlers.current?.cancel();
    });
  const swipeLabel =
    swipeDirection === 'delete'
      ? isWordDeck
        ? 'Delete word'
        : 'Delete card'
      : swipeDirection
        ? preferences.reviewMode === 'extended'
          ? extendedReviewAnswerLabels[swipeDirection]
          : reviewAnswerLabels[swipeDirection]
        : null;
  const swipeLabelColour =
    swipeDirection === 'delete'
      ? 'text-destructive'
      : swipeDirection
        ? answerColours[swipeDirection].text
        : 'text-muted-foreground';
  // Web shows a word card's translation large and whatever follows it
  // smaller (its [&_p+p] rule); the first blank line splits the two.
  // Until the area is measured the two cards simply share it.
  const cardSize = cardArea
    ? { height: Math.min((cardArea.height - 12) / 2, cardArea.width / 1.5) }
    : { flex: 1 };
  const answerParts = card.back.split(/\n\s*\n/);
  const [answerHead, answerDetail] =
    card.template_key === WORD_TO_TRANSLATION_TEMPLATE_KEY
      ? [answerParts[0], answerParts.slice(1).join('\n\n')]
      : [card.back, ''];
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
              // Like the answers: locked for a moment, not faded.
              className="opacity-100"
              disabled={isSaving || isLeaving}
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
              // Like the answers: locked for a moment, not faded.
              className="opacity-100"
              disabled={isSaving || isLeaving}
              onPress={() => setEditing({ kind: 'new' })}
            >
              <PlusIcon size={20} className="text-muted-foreground" />
            </Button>
          )}
        </View>
      </View>

      {/* The question stays and the answer appears below it, so the answer
          can be checked against the question. A tap on the question reveals,
          a long press edits (the pencil's shortcut; screen readers get it as
          an action). Once revealed, the answer card swipes and the question
          stays. Each card has a
          half of the space between the top row and the buttons, with web's
          large centred text; what does not fit is cut off, as on web. */}
      <View
        className="flex-1 justify-center gap-3"
        onLayout={(event) => setCardArea(event.nativeEvent.layout)}
      >
        <Pressable
          style={cardSize}
          accessibilityRole="button"
          accessibilityLabel={isFlipped ? 'Question' : 'Show the answer'}
          accessibilityActions={
            editor.canEdit(card)
              ? [{ name: 'edit', label: 'Edit this card' }]
              : []
          }
          onAccessibilityAction={(event) => {
            if (event.nativeEvent.actionName === 'edit') edit();
          }}
          disabled={isSaving || isLeaving}
          onPress={() => setIsFlipped(true)}
          onLongPress={edit}
        >
          {hasLanded ? (
            <Card className="flex-1 items-center justify-center overflow-hidden px-6 py-6">
              {nextFront && <Markdown content={nextFront} variant="card" />}
            </Card>
          ) : null}
          {!hasLanded && nextFront && (
            <Animated.View
              pointerEvents="none"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={[
                nextFadeIn,
                { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
              ]}
            >
              <Card className="flex-1 items-center justify-center overflow-hidden px-6 py-6">
                <Markdown content={nextFront} variant="card" />
              </Card>
            </Animated.View>
          )}
          {!hasLanded && (
            <Animated.View style={[questionFade, { flex: 1 }]}>
              <Card className="flex-1 items-center justify-center overflow-hidden px-6 py-6">
                <Markdown content={card.front} variant="card" />
              </Card>
            </Animated.View>
          )}
        </Pressable>
        {/* The answer's space is kept before it shows, so revealing
                does not move the question. */}
        {(!isFlipped || hasLanded) && (
          <View
            style={cardSize}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          />
        )}
        {isFlipped && !hasLanded && (
          // Only the answer is swiped away; the question stays put.
          <GestureDetector gesture={swipe}>
            <Animated.View style={[cardMotion, cardSize]}>
              <Card
                accessibilityLabel="Answer"
                className="flex-1 items-center justify-center overflow-hidden px-6 py-6"
              >
                {swipeLabel && (
                  <Text
                    className={`absolute left-0 right-0 top-3 text-center text-sm font-semibold uppercase ${swipeLabelColour}`}
                  >
                    {swipeLabel}
                  </Text>
                )}
                <Markdown content={answerHead} variant="card" />
                {answerDetail ? (
                  <View className="mt-3">
                    <Markdown content={answerDetail} variant="card-detail" />
                  </View>
                ) : null}
              </Card>
            </Animated.View>
          </GestureDetector>
        )}
      </View>

      {saveError ? (
        <Text className="text-center text-destructive">{saveError}</Text>
      ) : null}

      {layoutHint && (
        <Text className="text-center text-sm text-muted-foreground">
          {layoutHint}
        </Text>
      )}

      {!isFlipped ? (
        // 48 high, Android's touch target size, like the answers after it.
        <Button
          variant="outline"
          className="h-12 sm:h-12"
          onPress={() => setIsFlipped(true)}
        >
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
              // Locked only while an answer is on its way, a moment too
              // short to show: fading them made the change flicker.
              className={`h-auto min-h-12 flex-1 flex-col gap-0.5 px-1 py-2 opacity-100 ${answerColours[answer].button}`}
              disabled={isSaving || isLeaving}
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
