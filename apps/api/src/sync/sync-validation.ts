import type {
  SyncEngineOptions,
  StoredChange,
  SyncStoreTx,
  WireRow,
} from '@remelondb/server';
import type { DrizzleStore } from '@remelondb/store-drizzle';

const USER_DECKS = 'user_decks';
const USER_CARDS = 'user_cards';
const REVIEW_EVENTS = 'review_events';

interface PushRelationshipState {
  readonly submittedOwnedIds: Map<string, Set<string>>;
  readonly blockedDeletes: Map<string, Set<string>>;
}

const relationshipState = new WeakMap<
  SyncStoreTx<string>,
  PushRelationshipState
>();

const activeIds = (changes: readonly StoredChange[]): Set<string> =>
  new Set(
    changes.filter((change) => change.row !== null).map((change) => change.id),
  );

const tombstoneIds = (changes: readonly StoredChange[]): Set<string> =>
  new Set(
    changes.filter((change) => change.row === null).map((change) => change.id),
  );

const stringField = (row: WireRow, field: string): string | null => {
  const value = row[field];
  return typeof value === 'string' ? value : null;
};

const liveRows = (changes: readonly StoredChange[]): WireRow[] =>
  changes.flatMap((change) => (change.row === null ? [] : [change.row]));

const requestedDeletes = (
  tx: SyncStoreTx<string>,
  table: string,
  rows: readonly WireRow[],
): Set<string> => {
  const submitted = relationshipState.get(tx)?.submittedOwnedIds.get(table);
  if (!submitted) return new Set();
  const rowIds = new Set(rows.map((row) => row.id));
  return new Set([...submitted].filter((id) => !rowIds.has(id)));
};

const blockDeletes = (
  tx: SyncStoreTx<string>,
  table: string,
  ids: ReadonlySet<string>,
): void => {
  const state = relationshipState.get(tx);
  if (!state || ids.size === 0) return;
  const blocked = state.blockedDeletes.get(table) ?? new Set<string>();
  for (const id of ids) blocked.add(id);
  state.blockedDeletes.set(table, blocked);
};

async function cascadeDeckTombstones(
  tx: SyncStoreTx<string>,
  scope: string,
  deckIds: readonly string[],
): Promise<void> {
  const decks = new Set(deckIds);
  const cardIds = liveRows(await tx.changedSince(USER_CARDS, scope, 0))
    .filter((card) => {
      const deckId = stringField(card, 'deck_id');
      return deckId !== null && decks.has(deckId);
    })
    .map((card) => card.id);

  if (cardIds.length > 0) {
    await cascadeCardTombstones(tx, scope, cardIds);
  }
  await tx.tombstone(USER_DECKS, scope, deckIds);
}

async function cascadeCardTombstones(
  tx: SyncStoreTx<string>,
  scope: string,
  cardIds: readonly string[],
): Promise<void> {
  const cards = new Set(cardIds);
  const reviewIds = liveRows(await tx.changedSince(REVIEW_EVENTS, scope, 0))
    .filter((review) => {
      const cardId = stringField(review, 'user_card_id');
      return cardId !== null && cards.has(cardId);
    })
    .map((review) => review.id);

  if (reviewIds.length > 0) {
    await tx.tombstone(REVIEW_EVENTS, scope, reviewIds);
  }
  await tx.tombstone(USER_CARDS, scope, cardIds);
}

/**
 * The engine checks ownership before cross-validation. Recording those owned
 * ids lets cross-validation distinguish rows from deletes even though the
 * current remelonDB hook receives only created/updated rows.
 */
export function withSyncRelationshipDeletionPolicy(
  store: DrizzleStore<string>,
): DrizzleStore<string> {
  return {
    gc: (floor) => store.gc(floor),
    transaction: (scope, mode, work) =>
      store.transaction(scope, mode, (tx) => {
        if (mode !== 'push') return work(tx);

        const state: PushRelationshipState = {
          submittedOwnedIds: new Map(),
          blockedDeletes: new Map(),
        };
        const wrapped: SyncStoreTx<string> = {
          ...tx,
          foreignIds: async (table, txScope, ids) => {
            const foreign = await tx.foreignIds(table, txScope, ids);
            const foreignSet = new Set(foreign);
            const owned = state.submittedOwnedIds.get(table) ?? new Set();
            for (const id of ids) {
              if (!foreignSet.has(id)) owned.add(id);
            }
            state.submittedOwnedIds.set(table, owned);
            return foreign;
          },
          tombstone: async (table, txScope, ids) => {
            const blocked = state.blockedDeletes.get(table) ?? new Set();
            const allowed = ids.filter((id) => !blocked.has(id));
            if (allowed.length === 0) return;

            if (table === USER_DECKS) {
              await cascadeDeckTombstones(tx, txScope, allowed);
              return;
            }
            if (table === USER_CARDS) {
              await cascadeCardTombstones(tx, txScope, allowed);
              return;
            }
            await tx.tombstone(table, txScope, allowed);
          },
        };
        relationshipState.set(wrapped, state);
        return work(wrapped);
      }),
  };
}

/**
 * Validates relationships against both the authenticated scope's durable
 * rows and valid parent rows included in the same push.
 */
export const crossValidateSyncRelationships: NonNullable<
  SyncEngineOptions<string>['crossValidate']
> = async (tx, scope, rows) => {
  const deckRows = rows[USER_DECKS] ?? [];
  const cardRows = rows[USER_CARDS] ?? [];
  const reviewRows = rows[REVIEW_EVENTS] ?? [];

  const deckChanges = await tx.changedSince(USER_DECKS, scope, 0);
  const ownedDeckIds = activeIds(deckChanges);
  const deletedDeckIds = tombstoneIds(deckChanges);

  for (const deck of deckRows) {
    if (!deletedDeckIds.has(deck.id)) ownedDeckIds.add(deck.id);
  }

  const deckDeletes = new Set(
    [...requestedDeletes(tx, USER_DECKS, deckRows)].filter((id) =>
      ownedDeckIds.has(id),
    ),
  );

  const rejectedCards = cardRows.filter((card) => {
    const deckId = stringField(card, 'deck_id');
    return deckId === null || !ownedDeckIds.has(deckId);
  });
  const rejectedCardIds = new Set(rejectedCards.map((card) => card.id));
  const blockedDeckDeletes = new Set<string>();
  for (const card of cardRows) {
    if (rejectedCardIds.has(card.id)) continue;
    const deckId = stringField(card, 'deck_id');
    if (deckId !== null && deckDeletes.has(deckId)) {
      blockedDeckDeletes.add(deckId);
    }
  }

  const cardChanges = await tx.changedSince(USER_CARDS, scope, 0);
  const ownedCardIds = activeIds(cardChanges);
  const deletedCardIds = tombstoneIds(cardChanges);
  const cardDeckIds = new Map<string, string>();
  for (const card of liveRows(cardChanges)) {
    const deckId = stringField(card, 'deck_id');
    if (deckId !== null) cardDeckIds.set(card.id, deckId);
  }

  for (const card of cardRows) {
    if (!rejectedCardIds.has(card.id) && !deletedCardIds.has(card.id)) {
      ownedCardIds.add(card.id);
      const deckId = stringField(card, 'deck_id');
      if (deckId !== null) cardDeckIds.set(card.id, deckId);
    }
  }

  const cardDeletes = new Set(
    [...requestedDeletes(tx, USER_CARDS, cardRows)].filter((id) =>
      ownedCardIds.has(id),
    ),
  );

  const rejectedReviews = reviewRows.filter((review) => {
    const cardId = stringField(review, 'user_card_id');
    return cardId === null || !ownedCardIds.has(cardId);
  });
  const rejectedReviewIds = new Set(rejectedReviews.map((review) => review.id));
  const blockedCardDeletes = new Set<string>();
  for (const review of reviewRows) {
    if (rejectedReviewIds.has(review.id)) continue;
    const cardId = stringField(review, 'user_card_id');
    if (cardId === null) continue;
    if (cardDeletes.has(cardId)) blockedCardDeletes.add(cardId);
    const deckId = cardDeckIds.get(cardId);
    if (deckId !== undefined && deckDeletes.has(deckId)) {
      blockedDeckDeletes.add(deckId);
    }
  }

  blockDeletes(tx, USER_DECKS, blockedDeckDeletes);
  blockDeletes(tx, USER_CARDS, blockedCardDeletes);

  return {
    [USER_DECKS]: [...blockedDeckDeletes],
    [USER_CARDS]: [
      ...rejectedCards.map((card) => card.id),
      ...blockedCardDeletes,
    ],
    [REVIEW_EVENTS]: rejectedReviews.map((review) => review.id),
  };
};
