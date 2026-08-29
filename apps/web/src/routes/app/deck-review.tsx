import { Button } from '@/components/ui/button';
import { ReviewSession } from '@/components/review/ReviewSession';
import { useStore } from '@/hooks/useStore';
import { getDeckDueCardsQuery } from '@/offline/queries';
import { useQuery } from '@remelondb/core/react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { authClient } from '@/lib/auth-client';
import { saveLastReviewDeckId } from '@/lib/review-preferences';

type DeckReviewSearch = {
  deckId?: string;
};

export const Route = createFileRoute('/app/deck-review')({
  validateSearch: (search: Record<string, unknown>): DeckReviewSearch => ({
    deckId:
      typeof search.deckId === 'string' && search.deckId.trim().length > 0
        ? search.deckId
        : undefined,
  }),
  component: DeckReviewRoute,
});

function DeckReviewRoute() {
  const { deckId } = Route.useSearch();
  const store = useStore();
  const navigate = useNavigate();
  const { data: session } = authClient.useSession();
  const dueCardsQuery = useMemo(
    () =>
      store.db && deckId
        ? getDeckDueCardsQuery(store.db, deckId, Date.now())
        : null,
    [store.db, deckId],
  );
  const { data: dueCards = [], isLoading: dueCardsLoading } = useQuery(
    dueCardsQuery,
  );
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

  if (dueCardsLoading) {
    return (
      <main
        className="flex min-h-80 flex-col items-center justify-center gap-4 p-4"
        role="status"
        aria-live="polite"
      >
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">
          Loading cards for review...
        </p>
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
      onExit={() => navigate({ to: '/app/dashboard' })}
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
          <Link to="/app/dashboard">Back to dashboard</Link>
        </Button>
      )}
    </main>
  );
}
