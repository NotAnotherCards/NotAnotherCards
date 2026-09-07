import { Button } from '@/components/ui/button';
import { type Card, useStore } from '@/hooks/useStore';
import { authClient } from '@/lib/auth-client';
import { saveLastReviewDeckId } from '@/lib/review-preferences';
import { Link, useNavigate } from '@tanstack/react-router';
import { AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ReviewSession } from './ReviewSession';

type DeckReviewPageProps = {
  deckId?: string;
};

type ActiveReviewSession = {
  deckId: string;
  cards: Card[];
};

const REVIEW_BATCH_SIZE = 10;

export function DeckReviewPage({ deckId }: DeckReviewPageProps) {
  const store = useStore();
  const navigate = useNavigate();
  const { data: session } = authClient.useSession();
  const [activeSession, setActiveSession] =
    useState<ActiveReviewSession | null>(null);
  const getDueCards = (id: string) =>
    store
      .getCardsForDeck(id)
      .filter((card) => card.due_at <= Date.now())
      .sort((first, second) => first.due_at - second.due_at);
  const dueCards = deckId ? getDueCards(deckId) : [];
  const deck = store.decks.find((item) => item.id === deckId);

  useEffect(() => {
    if (deck && session?.user.id) {
      saveLastReviewDeckId(session.user.id, deck.id);
    }
  }, [deck, session?.user.id]);

  useEffect(() => {
    if (activeSession && activeSession.deckId !== deckId) {
      setActiveSession(null);
    }
  }, [activeSession, deckId]);

  useEffect(() => {
    if (!deckId || !deck || !store.ready || dueCards.length === 0) return;

    if (activeSession?.deckId === deckId) return;

    setActiveSession({ deckId, cards: dueCards.slice(0, REVIEW_BATCH_SIZE) });
  }, [activeSession?.deckId, deck, deckId, dueCards, store.ready]);

  const hasActiveSession =
    activeSession !== null && activeSession.deckId === deckId;
  const sessionCards = hasActiveSession ? activeSession.cards : dueCards;

  if (!deckId) {
    return (
      <ReviewRecovery
        title="Choose a deck first"
        message="Start a review from a specific deck."
      />
    );
  }

  if (store.isTakenOver) {
    return (
      <ReviewRecovery
        title="Database inactive"
        message="Your offline database is open in another tab."
        actionLabel="Use here instead"
        onAction={store.reconnect}
      />
    );
  }

  if (store.error) {
    return (
      <ReviewRecovery
        title="Could not load your deck"
        message={store.error}
        actionLabel="Retry"
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
        <p className="text-sm text-muted-foreground">Loading your deck...</p>
      </main>
    );
  }

  if (!deck) {
    return (
      <ReviewRecovery
        title="Deck not found"
        message="This deck does not exist or was deleted."
      />
    );
  }

  if (!hasActiveSession && dueCards.length === 0) {
    return (
      <ReviewRecovery
        title="No cards due"
        message={`There are no cards due in ${deck.title} right now.`}
      />
    );
  }

  return (
    <ReviewSession
      key={deckId}
      cards={sessionCards}
      deckTitle={deck.title}
      onExit={() => navigate({ to: '/dashboard' })}
      onCreateCard={async (data) => {
        await store.createCard(deckId, data.front, data.back);
      }}
      onRecordReview={store.recordReview}
      onDeleteNote={store.deleteNote}
      onRequestNextBatch={() => getDueCards(deckId).slice(0, REVIEW_BATCH_SIZE)}
    />
  );
}

type ReviewRecoveryProps = {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

function ReviewRecovery({
  title,
  message,
  actionLabel,
  onAction,
}: ReviewRecoveryProps) {
  return (
    <main className="mx-auto flex min-h-80 w-full max-w-md flex-col items-center justify-center gap-4 p-4 text-center">
      <div role="alert" className="space-y-2">
        <AlertCircle className="mx-auto size-8 text-muted-foreground" />
        <h1 className="text-xl font-bold">{title}</h1>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>

      {onAction && actionLabel ? (
        <Button onClick={onAction} className="cursor-pointer gap-1.5">
          <RefreshCw className="size-4" />
          {actionLabel}
        </Button>
      ) : (
        <Button asChild>
          <Link to="/dashboard">Back to dashboard</Link>
        </Button>
      )}
    </main>
  );
}
