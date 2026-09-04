import type {
  SyncEngineOptions,
  StoredChange,
  SyncStoreTx,
  WireRow,
} from '@remelondb/server';
import type { DrizzleStore } from '@remelondb/store-drizzle';
import {
  cardId,
  noteDeckId,
  noteTypeRegistry,
  validateNoteFieldsJson,
} from '@repo/offline-db';

const USER_DECKS = 'user_decks';
const USER_NOTES = 'user_notes';
const USER_CARDS = 'user_cards';
const USER_NOTE_DECKS = 'user_note_decks';
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

    const submittedUsernames = profileRows.flatMap((profile) => {
      const username = stringField(profile, 'username');
      return username === null ? [] : [username];
    });
    const usernameOwners =
      submittedUsernames.length === 0
        ? new Map<string, string>()
        : await findProfileUsernameOwners(submittedUsernames);

    // Durable parent state is only needed when this push references it. Parent
    // deletes without new/updated children are handled by the cascade wrapper.
    const deckChanges =
      membershipRows.length === 0
        ? []
        : await tx.changedSince(USER_DECKS, scope, 0);
    const ownedDeckIds = activeIds(deckChanges);
    const deletedDeckIds = tombstoneIds(deckChanges);

    for (const deck of deckRows) {
      if (!deletedDeckIds.has(deck.id)) ownedDeckIds.add(deck.id);
    }

    const deckDeletes = new Set(deckDeletesRequested);

    // RemelonDB currently rebuilds table schemas from `.shape`, which drops
    // UserNoteRow's object-level superRefine. Keep this contract at the
    // application cross-validation boundary shared by both engine paths.
    const rejectedNotes = noteRows.filter((note) => {
      const noteType = stringField(note, 'note_type');
      const fieldsJson = stringField(note, 'fields_json');
      const fieldsVersion = note['fields_version'];
      return (
        noteType === null ||
        fieldsJson === null ||
        typeof fieldsVersion !== 'number' ||
        !validateNoteFieldsJson(noteType, fieldsVersion, fieldsJson).success
      );
    });
    const rejectedNoteIds = new Set(rejectedNotes.map((note) => note.id));

    const noteChanges =
      cardRows.length === 0 && membershipRows.length === 0
        ? []
        : await tx.changedSince(USER_NOTES, scope, 0);
    const ownedNoteIds = activeIds(noteChanges);
    const deletedNoteIds = tombstoneIds(noteChanges);

    for (const note of noteRows) {
      if (!rejectedNoteIds.has(note.id) && !deletedNoteIds.has(note.id)) {
        ownedNoteIds.add(note.id);
      }
    }

    const noteDeletes = new Set(noteDeletesRequested);

    // For a card whose note travels in the same push with a registered
    // type, the template key must belong to that type. Cards of stored
    // notes are not re-read here (validation stays pure). The unregistered
    // branch is defensive only: such notes are already rejected above.
    const templateKeysByNoteId = new Map<string, ReadonlySet<string>>();
    for (const note of noteRows) {
      const noteType = stringField(note, 'note_type');
      const fieldsVersion = note['fields_version'];
      const entry =
        noteType !== null && typeof fieldsVersion === 'number'
          ? noteTypeRegistry[noteType]?.[fieldsVersion]
          : undefined;
      if (entry) {
        templateKeysByNoteId.set(
          note.id,
          new Set(entry.templates.map((template) => template.key)),
        );
      }
    }

    const rejectedCards = cardRows.filter((card) => {
      const noteId = stringField(card, 'note_id');
      const templateKey = stringField(card, 'template_key');
      if (
        noteId === null ||
        templateKey === null ||
        !ownedNoteIds.has(noteId) ||
        card.id !== cardId(noteId, templateKey)
      ) {
        return true;
      }
      const knownKeys = templateKeysByNoteId.get(noteId);
      return knownKeys !== undefined && !knownKeys.has(templateKey);
    });
    const rejectedCardIds = new Set(rejectedCards.map((card) => card.id));
    const blockedNoteDeletes = new Set<string>();
    for (const card of cardRows) {
      if (rejectedCardIds.has(card.id)) continue;
      const noteId = stringField(card, 'note_id');
      if (noteId !== null && noteDeletes.has(noteId)) {
        blockedNoteDeletes.add(noteId);
      }
    }

    const rejectedMemberships = membershipRows.filter((membership) => {
      const noteId = stringField(membership, 'note_id');
      const deckId = stringField(membership, 'deck_id');
      return (
        noteId === null ||
        deckId === null ||
        !ownedNoteIds.has(noteId) ||
        !ownedDeckIds.has(deckId) ||
        membership.id !== noteDeckId(noteId, deckId)
      );
    });
    const rejectedMembershipIds = new Set(
      rejectedMemberships.map((membership) => membership.id),
    );
    const blockedDeckDeletes = new Set<string>();
    for (const membership of membershipRows) {
      if (rejectedMembershipIds.has(membership.id)) continue;
      const noteId = stringField(membership, 'note_id');
      const deckId = stringField(membership, 'deck_id');
      if (noteId !== null && noteDeletes.has(noteId)) {
        blockedNoteDeletes.add(noteId);
      }
      if (deckId !== null && deckDeletes.has(deckId)) {
        blockedDeckDeletes.add(deckId);
      }
    }

    const cardChanges =
      reviewRows.length === 0
        ? []
        : await tx.changedSince(USER_CARDS, scope, 0);
    const ownedCardIds = activeIds(cardChanges);
    const deletedCardIds = tombstoneIds(cardChanges);
    const cardNoteIds = new Map<string, string>();
    for (const card of liveRows(cardChanges)) {
      const noteId = stringField(card, 'note_id');
      if (noteId !== null) cardNoteIds.set(card.id, noteId);
    }

    for (const card of cardRows) {
      if (!rejectedCardIds.has(card.id) && !deletedCardIds.has(card.id)) {
        ownedCardIds.add(card.id);
        const noteId = stringField(card, 'note_id');
        if (noteId !== null) cardNoteIds.set(card.id, noteId);
      }
    }

    const cardDeletes = new Set(cardDeletesRequested);

    const rejectedReviews = reviewRows.filter((review) => {
      const reviewCardId = stringField(review, 'user_card_id');
      return reviewCardId === null || !ownedCardIds.has(reviewCardId);
    });
    const rejectedReviewIds = new Set(
      rejectedReviews.map((review) => review.id),
    );
    const blockedCardDeletes = new Set<string>();
    for (const review of reviewRows) {
      if (rejectedReviewIds.has(review.id)) continue;
      const reviewCardId = stringField(review, 'user_card_id');
      if (reviewCardId === null) continue;
      if (cardDeletes.has(reviewCardId)) {
        blockedCardDeletes.add(reviewCardId);
      }
      const noteId = cardNoteIds.get(reviewCardId);
      if (noteId !== undefined && noteDeletes.has(noteId)) {
        blockedNoteDeletes.add(noteId);
      }
    }

    return {
      [USER_DECKS]: [...blockedDeckDeletes],
      [USER_NOTES]: [
        ...rejectedNotes.map((note) => note.id),
        ...blockedNoteDeletes,
      ],
      [USER_CARDS]: [
        ...rejectedCards.map((card) => card.id),
        ...blockedCardDeletes,
      ],
      [USER_NOTE_DECKS]: rejectedMemberships.map((membership) => membership.id),
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
