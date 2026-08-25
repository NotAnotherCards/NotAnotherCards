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
const USER_PROFILES = 'user_profiles';

export type ProfileUsernameOwnerLookup = (
  usernames: readonly string[],
) => Promise<ReadonlyMap<string, string>>;

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
 * Cascades deck/card deletions to their children. Ids rejected by
 * cross-validation never reach here: the engine strips them from the
 * requested deletes before calling `tombstone`
 */
export function withSyncCascadingDeletes(
  store: DrizzleStore<string>,
): DrizzleStore<string> {
  return {
    gc: (floor) => store.gc(floor),
    transaction: (scope, mode, work) =>
      store.transaction(scope, mode, (tx) => {
        if (mode !== 'push') return work(tx);

        const wrapped: SyncStoreTx<string> = {
          ...tx,
          tombstone: async (table, txScope, ids) => {
            if (table === USER_DECKS) {
              await cascadeDeckTombstones(tx, txScope, ids);
              return;
            }
            if (table === USER_CARDS) {
              await cascadeCardTombstones(tx, txScope, ids);
              return;
            }
            await tx.tombstone(table, txScope, ids);
          },
        };
        return work(wrapped);
      }),
  };
}

/**
 * Validates relationships against both the authenticated scope's durable
 * rows and valid parent rows included in the same push
 */
export function createCrossValidateSyncRelationships(
  findProfileUsernameOwners: ProfileUsernameOwnerLookup,
): NonNullable<SyncEngineOptions<string>['crossValidateChanges']> {
  return async (tx, scope, changes) => {
    const deckRows = changes[USER_DECKS]?.rows ?? [];
    const deckDeletesRequested = changes[USER_DECKS]?.deleted ?? [];
    const cardRows = changes[USER_CARDS]?.rows ?? [];
    const cardDeletesRequested = changes[USER_CARDS]?.deleted ?? [];
    const reviewRows = changes[REVIEW_EVENTS]?.rows ?? [];
    const profileRows = changes[USER_PROFILES]?.rows ?? [];

    const submittedUsernames = profileRows.flatMap((profile) => {
      const username = stringField(profile, 'username');
      return username === null ? [] : [username];
    });
    const usernameOwners =
      submittedUsernames.length === 0
        ? new Map<string, string>()
        : await findProfileUsernameOwners(submittedUsernames);

    const deckChanges = await tx.changedSince(USER_DECKS, scope, 0);
    const ownedDeckIds = activeIds(deckChanges);
    const deletedDeckIds = tombstoneIds(deckChanges);

    for (const deck of deckRows) {
      if (!deletedDeckIds.has(deck.id)) ownedDeckIds.add(deck.id);
    }

    const deckDeletes = new Set(
      deckDeletesRequested.filter((id) => ownedDeckIds.has(id)),
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
      cardDeletesRequested.filter((id) => ownedCardIds.has(id)),
    );

    const rejectedReviews = reviewRows.filter((review) => {
      const cardId = stringField(review, 'user_card_id');
      return cardId === null || !ownedCardIds.has(cardId);
    });
    const rejectedReviewIds = new Set(
      rejectedReviews.map((review) => review.id),
    );
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

    return {
      [USER_DECKS]: [...blockedDeckDeletes],
      [USER_CARDS]: [
        ...rejectedCards.map((card) => card.id),
        ...blockedCardDeletes,
      ],
      [REVIEW_EVENTS]: rejectedReviews.map((review) => review.id),
      [USER_PROFILES]: profileRows
        .filter((profile) => {
          if (profile.id !== scope) return true;
          const username = stringField(profile, 'username');
          if (username === null) return false;
          const owner = usernameOwners.get(username);
          return owner !== undefined && owner !== profile.id;
        })
        .map((profile) => profile.id),
    };
  };
}
