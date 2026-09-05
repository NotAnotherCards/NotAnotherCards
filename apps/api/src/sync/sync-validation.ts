import type { SyncEngineOptions, SyncStoreTx } from '@remelondb/server';
import type { DrizzleStore } from '@remelondb/store-drizzle';
import {
  liveRows,
  stringField,
  validateCardRows,
  validateDeckRows,
  validateMembershipRows,
  validateNoteRows,
  validateReviewRows,
} from './sync-change-validation';

const USER_DECKS = 'user_decks';
const USER_NOTES = 'user_notes';
const USER_CARDS = 'user_cards';
const USER_NOTE_DECKS = 'user_note_decks';
const REVIEW_EVENTS = 'review_events';
const USER_PROFILES = 'user_profiles';

export type ProfileUsernameOwnerLookup = (
  usernames: readonly string[],
) => Promise<ReadonlyMap<string, string>>;

async function cascadeDeckTombstones(
  tx: SyncStoreTx<string>,
  scope: string,
  deckIds: readonly string[],
): Promise<void> {
  const decks = new Set(deckIds);
  const membershipIds = liveRows(
    await tx.changedSince(USER_NOTE_DECKS, scope, 0),
  )
    .filter((membership) => {
      const deckId = stringField(membership, 'deck_id');
      return deckId !== null && decks.has(deckId);
    })
    .map((membership) => membership.id);

  if (membershipIds.length > 0) {
    await tx.tombstone(USER_NOTE_DECKS, scope, membershipIds);
  }
  await tx.tombstone(USER_DECKS, scope, deckIds);
}

async function cascadeNoteTombstones(
  tx: SyncStoreTx<string>,
  scope: string,
  noteIds: readonly string[],
): Promise<void> {
  const notes = new Set(noteIds);
  const cardIds = liveRows(await tx.changedSince(USER_CARDS, scope, 0))
    .filter((card) => {
      const noteId = stringField(card, 'note_id');
      return noteId !== null && notes.has(noteId);
    })
    .map((card) => card.id);
  const membershipIds = liveRows(
    await tx.changedSince(USER_NOTE_DECKS, scope, 0),
  )
    .filter((membership) => {
      const noteId = stringField(membership, 'note_id');
      return noteId !== null && notes.has(noteId);
    })
    .map((membership) => membership.id);

  if (cardIds.length > 0) {
    await cascadeCardTombstones(tx, scope, cardIds);
  }
  if (membershipIds.length > 0) {
    await tx.tombstone(USER_NOTE_DECKS, scope, membershipIds);
  }
  await tx.tombstone(USER_NOTES, scope, noteIds);
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
 * Cascades deck/note/card deletions to their children. Ids rejected by
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
            if (table === USER_NOTES) {
              await cascadeNoteTombstones(tx, txScope, ids);
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
    const noteRows = changes[USER_NOTES]?.rows ?? [];
    const noteDeletesRequested = changes[USER_NOTES]?.deleted ?? [];
    const cardRows = changes[USER_CARDS]?.rows ?? [];
    const cardDeletesRequested = changes[USER_CARDS]?.deleted ?? [];
    const membershipRows = changes[USER_NOTE_DECKS]?.rows ?? [];
    const reviewRows = changes[REVIEW_EVENTS]?.rows ?? [];
    const profileRows = changes[USER_PROFILES]?.rows ?? [];

    const deckChanges =
      membershipRows.length === 0 && deckRows.length === 0
        ? []
        : await tx.changedSince(USER_DECKS, scope, 0);
    const decks = validateDeckRows(deckRows, deckChanges);
    const deckDeletes = new Set(deckDeletesRequested);

    const noteChanges =
      cardRows.length === 0 &&
      membershipRows.length === 0 &&
      noteRows.length === 0
        ? []
        : await tx.changedSince(USER_NOTES, scope, 0);
    const notes = validateNoteRows(noteRows, noteChanges);
    const noteDeletes = new Set(noteDeletesRequested);
    const validatedCards = validateCardRows(
      cardRows,
      noteRows,
      noteChanges,
      notes.rejectedNoteIds,
      notes.ownedNoteIds,
      noteDeletes,
    );
    const memberships = validateMembershipRows(
      membershipRows,
      notes.ownedNoteIds,
      decks.ownedDeckIds,
      notes.noteTypeById,
      decks.deckTypeById,
      noteDeletes,
      deckDeletes,
    );

    const cardChanges =
      reviewRows.length === 0
        ? []
        : await tx.changedSince(USER_CARDS, scope, 0);
    const cardDeletes = new Set(cardDeletesRequested);
    const reviews = validateReviewRows(
      reviewRows,
      cardRows,
      cardChanges,
      validatedCards.rejectedCardIds,
      cardDeletes,
      noteDeletes,
    );

    const submittedUsernames = profileRows.flatMap((profile) => {
      const username = stringField(profile, 'username');
      return username === null ? [] : [username];
    });
    const usernameOwners =
      submittedUsernames.length === 0
        ? new Map<string, string>()
        : await findProfileUsernameOwners(submittedUsernames);

    return {
      [USER_DECKS]: [
        ...decks.rejectedDecks.map((deck) => deck.id),
        ...memberships.blockedDeckDeletes,
      ],
      [USER_NOTES]: [
        ...notes.rejectedNotes.map((note) => note.id),
        ...new Set([
          ...validatedCards.blockedNoteDeletes,
          ...memberships.blockedNoteDeletes,
          ...reviews.blockedNoteDeletes,
        ]),
      ],
      [USER_CARDS]: [
        ...validatedCards.rejectedCards.map((card) => card.id),
        ...reviews.blockedCardDeletes,
      ],
      [USER_NOTE_DECKS]: memberships.rejectedMemberships.map(
        (membership) => membership.id,
      ),
      [REVIEW_EVENTS]: reviews.rejectedReviews.map((review) => review.id),
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
