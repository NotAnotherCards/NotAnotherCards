import { DeckReviewPage } from '@/components/review/DeckReviewPage';
import { createFileRoute } from '@tanstack/react-router';

type DeckReviewSearch = {
  deckId?: string;
  collection?: 'no-deck';
};

export const Route = createFileRoute('/_protected/deck-review')({
  validateSearch: (search: Record<string, unknown>): DeckReviewSearch => ({
    deckId:
      typeof search.deckId === 'string' && search.deckId.trim().length > 0
        ? search.deckId
        : undefined,
    collection: search.collection === 'no-deck' ? 'no-deck' : undefined,
  }),
  component: DeckReviewRoute,
});

function DeckReviewRoute() {
  const { deckId, collection } = Route.useSearch();
  return <DeckReviewPage deckId={deckId} collection={collection} />;
}
