import { Button } from '@/components/ui/button';
import { useStore } from '@/hooks/useStore';
import { authClient } from '@/lib/auth-client';
import { saveLastReviewDeckId } from '@/lib/review-preferences';
import { Link, useNavigate } from '@tanstack/react-router';
import { AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { useEffect } from 'react';
import { ReviewSession } from './ReviewSession';

type DeckReviewPageProps = {
  deckId?: string;
};

export function DeckReviewPage({ deckId }: DeckReviewPageProps) {
  const store = useStore();
  const navigate = useNavigate();
  const { data: session } = authClient.useSession();
  const dueCards = deckId
    ? store
        .getCardsForDeck(deckId)
        .filter((card) => card.due_at <= Date.now())
        .sort((first, second) => first.due_at - second.due_at)
    : [];
  const deck = store.decks.find((item) => item.id === deckId);

  useEffect(() => {
    if (deck && session?.user.id) {
      saveLastReviewDeckId(session.user.id, deck.id);
    }
  }, [deck, session?.user.id]);

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

  if (dueCards.length === 0) {
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
      cards={dueCards}
      deckTitle={deck.title}
      onExit={() => navigate({ to: '/dashboard' })}
      onCreateCard={async (data) => {
        await store.createCard(deckId, data.front, data.back);
      }}
      onRecordReview={store.recordReview}
      onDeleteNote={store.deleteNote}
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
