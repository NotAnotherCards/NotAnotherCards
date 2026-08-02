import type { SyncEngineOptions, StoredChange, WireRow } from '@remelondb/server';

const activeIds = (changes: readonly StoredChange[]): Set<string> =>
  new Set(
    changes
      .filter((change) => change.row !== null)
      .map((change) => change.id),
  );

const tombstoneIds = (changes: readonly StoredChange[]): Set<string> =>
  new Set(
    changes
      .filter((change) => change.row === null)
      .map((change) => change.id),
  );

const stringField = (row: WireRow, field: string): string | null => {
  const value = row[field];
  return typeof value === 'string' ? value : null;
};

/**
 * Validates relationships against both the authenticated scope's durable
 * rows and valid parent rows included in the same push.
 */
export const crossValidateSyncRelationships: NonNullable<
  SyncEngineOptions<string>['crossValidate']
> = async (tx, scope, rows) => {
  const deckChanges = await tx.changedSince('user_decks', scope, 0);
  const ownedDeckIds = activeIds(deckChanges);
  const deletedDeckIds = tombstoneIds(deckChanges);

  for (const deck of rows.user_decks ?? []) {
    if (!deletedDeckIds.has(deck.id)) ownedDeckIds.add(deck.id);
  }

  const rejectedCards = (rows.user_cards ?? []).filter((card) => {
    const deckId = stringField(card, 'deck_id');
    return deckId === null || !ownedDeckIds.has(deckId);
  });
  const rejectedCardIds = new Set(rejectedCards.map((card) => card.id));

  const cardChanges = await tx.changedSince('user_cards', scope, 0);
  const ownedCardIds = activeIds(cardChanges);
  const deletedCardIds = tombstoneIds(cardChanges);

  for (const card of rows.user_cards ?? []) {
    if (!rejectedCardIds.has(card.id) && !deletedCardIds.has(card.id)) {
      ownedCardIds.add(card.id);
    }
  }

  const rejectedReviews = (rows.review_events ?? []).filter((review) => {
    const cardId = stringField(review, 'user_card_id');
    return cardId === null || !ownedCardIds.has(cardId);
  });

  return {
    user_cards: rejectedCards.map((card) => card.id),
    review_events: rejectedReviews.map((review) => review.id),
  };
};
