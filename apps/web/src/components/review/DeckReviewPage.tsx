import { Button } from '@/components/ui/button';
import { type Card, useStore } from '@/hooks/useStore';
import { authClient } from '@/lib/auth-client';
import {
  getReviewPreferences,
  getActivationCount,
  saveActivationCount,
  saveLastReviewDeckId,
} from '@/lib/review-preferences';
import {
  nextReviewBatch,
  selectDueCards,
  selectReviewBatch,
} from '@repo/offline-db';
import { Link, useNavigate } from '@tanstack/react-router';
import { AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReviewSession } from './ReviewSession';
import { ActivateMoreWords } from './ReviewDialogs';

type DeckReviewPageProps = {
  deckId?: string;
  collection?: 'no-deck';
};

type ActiveReviewSession = {
  deckId: string;
  cards: Card[];
};

export function DeckReviewPage({ deckId, collection }: DeckReviewPageProps) {
  const { t } = useTranslation();
  const store = useStore();
  const navigate = useNavigate();
  const { data: session } = authClient.useSession();
  const [activeSession, setActiveSession] =
    useState<ActiveReviewSession | null>(null);
  const [sessionVersion, setSessionVersion] = useState(0);
  const isNoDeckCollection = collection === 'no-deck';
  const reviewId = isNoDeckCollection ? 'no-deck' : deckId;
  const getDueCards = () =>
    selectDueCards(
      isNoDeckCollection
        ? store.getCardsWithoutDeck()
        : deckId
          ? store.getCardsForDeck(deckId)
          : [],
    );
  const dueCards = getDueCards();
  const deck = store.decks.find((item) => item.id === deckId);
  const reviewPreferences = getReviewPreferences(session?.user.id);
  const activationCount = getActivationCount(session?.user.id);
  const deckCards = deckId ? store.getCardsForDeck(deckId) : [];
  const isWordDeck = deck?.note_type === 'word';
  const inactiveItemCount = isWordDeck
    ? new Set(
        deckCards.filter((card) => !card.active).map((card) => card.note_id),
      ).size
    : deckCards.filter((card) => !card.active).length;
  const activationItemLabel = isWordDeck ? 'words' : 'cards';

  useEffect(() => {
    if (!isNoDeckCollection && deck && session?.user.id) {
      saveLastReviewDeckId(session.user.id, deck.id);
    }
  }, [deck, isNoDeckCollection, session?.user.id]);

  useEffect(() => {
    if (activeSession && activeSession.deckId !== reviewId) {
      setActiveSession(null);
    }
  }, [activeSession, reviewId]);

  useEffect(() => {
    if (
      !reviewId ||
      (!isNoDeckCollection && !deck) ||
      !store.ready ||
      dueCards.length === 0
    )
      return;

    if (activeSession?.deckId === reviewId) return;

    setActiveSession({ deckId: reviewId, cards: selectReviewBatch(dueCards) });
  }, [
    activeSession?.deckId,
    deck,
    dueCards,
    isNoDeckCollection,
    reviewId,
    store.ready,
  ]);

  const hasActiveSession =
    activeSession !== null && activeSession.deckId === reviewId;

  const sessionCards = hasActiveSession
    ? activeSession.cards
    : selectReviewBatch(dueCards);

  const activateMoreWords = async (count: number) => {
    if (!deckId) return;
    await store.activateWordsInDeck(deckId, count);
    saveActivationCount(session?.user.id, count);
    setActiveSession(null);
    setSessionVersion((version) => version + 1);
  };

  const exitReview = () => {
    void navigate({ to: '/dashboard' });
  };

  if (!reviewId) {
    return (
      <ReviewRecovery
        title={t('review.recovery.choose_deck_title', 'Choose a deck first')}
        message={t(
          'review.recovery.choose_deck_message',
          'Start a review from a specific deck.',
        )}
      />
    );
  }

  if (store.isTakenOver) {
    return (
      <ReviewRecovery
        title={t(
          'review.recovery.database_inactive_title',
          'Database inactive',
        )}
        message={t(
          'review.recovery.database_inactive_message',
          'Your offline database is open in another tab.',
        )}
        actionLabel={t('review.recovery.use_here', 'Use here instead')}
        onAction={store.reconnect}
      />
    );
  }

  if (!store.ready) {
    return (
      <main
        className="flex min-h-80 flex-col items-center justify-center gap-4 p-4"
        role="status"
        aria-live="polite"
      >
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">
          {t('review.recovery.loading_deck', 'Loading your deck...')}
        </p>
      </main>
    );
  }

  if (!isNoDeckCollection && !deck) {
    return (
      <ReviewRecovery
        title={t('review.recovery.deck_not_found_title', 'Deck not found')}
        message={t(
          'review.recovery.deck_not_found_message',
          'This deck does not exist or was deleted.',
        )}
      />
    );
  }

  if (!hasActiveSession && dueCards.length === 0) {
    return (
      <ReviewRecovery
        title={t('review.recovery.no_cards_due', {
          title: isNoDeckCollection
            ? t('deck.list.no_deck_title', 'Cards and words without a deck')
            : deck!.title,
        })}
        activationCount={
          !isNoDeckCollection && inactiveItemCount > 0
            ? activationCount
            : undefined
        }
        inactiveItemCount={isNoDeckCollection ? 0 : inactiveItemCount}
        itemLabel={activationItemLabel}
        onActivate={
          !isNoDeckCollection && inactiveItemCount > 0
            ? activateMoreWords
            : undefined
        }
        onExit={exitReview}
      />
    );
  }

  return (
    <ReviewSession
      key={`${reviewId}:${sessionVersion}`}
      cards={sessionCards}
      deckTitle={
        isNoDeckCollection
          ? t('deck.list.no_deck_title', 'Cards and words without a deck')
          : deck!.title
      }
      onExit={exitReview}
      onActivateMore={
        !isNoDeckCollection && inactiveItemCount > 0
          ? activateMoreWords
          : undefined
      }
      activationCount={
        !isNoDeckCollection && inactiveItemCount > 0
          ? activationCount
          : undefined
      }
      inactiveItemCount={isNoDeckCollection ? 0 : inactiveItemCount}
      activationItemLabel={activationItemLabel}
      onCreateCard={
        isNoDeckCollection
          ? undefined
          : async (data) => {
              await store.createCard(deckId!, data.front, data.back);
            }
      }
      onRecordReview={store.recordReview}
      onDeleteNote={store.deleteNote}
      onRequestNextBatch={() => nextReviewBatch(getDueCards)}
      reviewMode={reviewPreferences.reviewMode}
      showNextReviewInterval={reviewPreferences.showNextReviewInterval}
    />
  );
}

type ReviewRecoveryProps = {
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  activationCount?: number;
  inactiveItemCount?: number;
  itemLabel?: 'words' | 'cards';
  onActivate?: (count: number) => Promise<void>;
  onExit?: () => void;
};

function ReviewRecovery({
  title,
  message,
  actionLabel,
  onAction,
  activationCount,
  inactiveItemCount = 0,
  itemLabel = 'words',
  onActivate,
  onExit,
}: ReviewRecoveryProps) {
  const { t } = useTranslation();
  return (
    <main className="mx-auto flex min-h-80 w-full max-w-md flex-col items-center justify-center gap-4 p-4 text-center">
      <div role="alert" className="space-y-2">
        <AlertCircle className="mx-auto size-8 text-muted-foreground" />
        <h1 className="text-xl font-bold">{title}</h1>
        {message && <p className="text-sm text-muted-foreground">{message}</p>}
      </div>

      {onActivate && activationCount && onExit ? (
        <ActivateMoreWords
          onActivate={onActivate}
          onExit={onExit}
          initialCount={activationCount}
          inactiveItemCount={inactiveItemCount}
          itemLabel={itemLabel}
        />
      ) : onAction && actionLabel ? (
        <Button onClick={onAction} className="cursor-pointer gap-1.5">
          <RefreshCw className="size-4" />
          {actionLabel}
        </Button>
      ) : (
        <Button asChild>
          <Link to="/dashboard">
            {t('review.session.back_to_dashboard', 'Back to dashboard')}
          </Link>
        </Button>
      )}
    </main>
  );
}
