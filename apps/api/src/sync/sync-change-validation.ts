import type { StoredChange, WireRow } from '@remelondb/server';
import {
  cardId,
  compileNote,
  noteDeckId,
  noteTypeRegistry,
  validateNoteFieldsJson,
  WORD_NOTE_TYPE,
} from '@repo/offline-db';
import { LANGUAGES } from '@repo/schemas';

export const activeIds = (changes: readonly StoredChange[]): Set<string> =>
  new Set(
    changes.filter((change) => change.row !== null).map((change) => change.id),
  );

export const tombstoneIds = (changes: readonly StoredChange[]): Set<string> =>
  new Set(
    changes.filter((change) => change.row === null).map((change) => change.id),
  );

export const stringField = (row: WireRow, field: string): string | null => {
  const value = row[field];
  return typeof value === 'string' ? value : null;
};

export const liveRows = (changes: readonly StoredChange[]): WireRow[] =>
  changes.flatMap((change) => (change.row === null ? [] : [change.row]));

const knownLanguages = new Set<string>(
  LANGUAGES.map((language) => language.value),
);

export function validateDeckRows(
  deckRows: readonly WireRow[],
  deckChanges: readonly StoredChange[],
) {
  const ownedDeckIds = activeIds(deckChanges);
  const deletedDeckIds = tombstoneIds(deckChanges);
  const durableDeckType = new Map<string, string>();
  for (const change of deckChanges) {
    if (change.row === null) continue;
    const noteType = stringField(change.row, 'note_type');
    if (noteType !== null) durableDeckType.set(change.row.id, noteType);
  }

  for (const deck of deckRows) {
    if (!deletedDeckIds.has(deck.id)) ownedDeckIds.add(deck.id);
  }

  const rejectedDecks = deckRows.filter((deck) => {
    const noteType = stringField(deck, 'note_type');
    if (noteType === null || noteTypeRegistry[noteType] === undefined) {
      return true;
    }
    const stored = durableDeckType.get(deck.id);
    if (stored !== undefined && stored !== noteType) return true;
    const native = stringField(deck, 'native_language_id');
    const target = stringField(deck, 'target_language_id');
    if (noteType === WORD_NOTE_TYPE) {
      return (
        native === null ||
        target === null ||
        native === target ||
        !knownLanguages.has(native) ||
        !knownLanguages.has(target)
      );
    }
    return native !== null || target !== null;
  });
  const rejectedDeckIds = new Set(rejectedDecks.map((deck) => deck.id));
  const deckTypeById = new Map(durableDeckType);
  for (const deck of deckRows) {
    if (rejectedDeckIds.has(deck.id)) continue;
    const noteType = stringField(deck, 'note_type');
    if (noteType !== null) deckTypeById.set(deck.id, noteType);
  }

  return { ownedDeckIds, rejectedDecks, rejectedDeckIds, deckTypeById };
}

export function validateNoteRows(
  noteRows: readonly WireRow[],
  noteChanges: readonly StoredChange[],
) {
  const durableNoteIdentity = new Map<
    string,
    { type: string; version: number }
  >();
  for (const change of noteChanges) {
    if (change.row === null) continue;
    const noteType = stringField(change.row, 'note_type');
    const fieldsVersion = change.row['fields_version'];
    if (noteType !== null && typeof fieldsVersion === 'number') {
      durableNoteIdentity.set(change.row.id, {
        type: noteType,
        version: fieldsVersion,
      });
    }
  }

  const rejectedNotes = noteRows.filter((note) => {
    const noteType = stringField(note, 'note_type');
    const fieldsJson = stringField(note, 'fields_json');
    const fieldsVersion = note['fields_version'];
    if (
      noteType === null ||
      fieldsJson === null ||
      typeof fieldsVersion !== 'number' ||
      !validateNoteFieldsJson(noteType, fieldsVersion, fieldsJson).success
    ) {
      return true;
    }
    const stored = durableNoteIdentity.get(note.id);
    return (
      stored !== undefined &&
      (stored.type !== noteType || stored.version !== fieldsVersion)
    );
  });
  const rejectedNoteIds = new Set(rejectedNotes.map((note) => note.id));
  const ownedNoteIds = activeIds(noteChanges);
  const deletedNoteIds = tombstoneIds(noteChanges);
  for (const note of noteRows) {
    if (!rejectedNoteIds.has(note.id) && !deletedNoteIds.has(note.id)) {
      ownedNoteIds.add(note.id);
    }
  }

  const noteTypeById = new Map<string, string>();
  for (const [id, identity] of durableNoteIdentity) {
    noteTypeById.set(id, identity.type);
  }
  for (const note of noteRows) {
    if (rejectedNoteIds.has(note.id)) continue;
    const noteType = stringField(note, 'note_type');
    if (noteType !== null) noteTypeById.set(note.id, noteType);
  }

  return { ownedNoteIds, rejectedNotes, rejectedNoteIds, noteTypeById };
}

export function validateCardRows(
  cardRows: readonly WireRow[],
  noteRows: readonly WireRow[],
  noteChanges: readonly StoredChange[],
  rejectedNoteIds: ReadonlySet<string>,
  ownedNoteIds: ReadonlySet<string>,
  noteDeletes: ReadonlySet<string>,
) {
  const templateKeysByNoteId = new Map<string, ReadonlySet<string>>();
  for (const change of noteChanges) {
    if (change.row === null) continue;
    const noteType = stringField(change.row, 'note_type');
    const fieldsVersion = change.row['fields_version'];
    const entry =
      noteType !== null && typeof fieldsVersion === 'number'
        ? noteTypeRegistry[noteType]?.[fieldsVersion]
        : undefined;
    if (entry) {
      templateKeysByNoteId.set(
        change.row.id,
        new Set(entry.templates.map((template) => template.key)),
      );
    }
  }

  const compiledByNoteId = new Map<
    string,
    ReadonlyMap<string, { front: string; back: string }>
  >();
  for (const note of noteRows) {
    if (rejectedNoteIds.has(note.id)) continue;
    const noteType = stringField(note, 'note_type');
    const fieldsJson = stringField(note, 'fields_json');
    const fieldsVersion = note['fields_version'];
    if (
      noteType === null ||
      fieldsJson === null ||
      typeof fieldsVersion !== 'number' ||
      !noteTypeRegistry[noteType]?.[fieldsVersion]
    ) {
      continue;
    }
    const compiled = compileNote(
      noteType,
      fieldsVersion,
      JSON.parse(fieldsJson),
    );
    templateKeysByNoteId.set(note.id, new Set(compiled.templateKeys));
    compiledByNoteId.set(
      note.id,
      new Map(
        compiled.cards.map((card) => [
          card.templateKey,
          { front: card.front, back: card.back },
        ]),
      ),
    );
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
    if (knownKeys !== undefined && !knownKeys.has(templateKey)) return true;
    const compiledCards = compiledByNoteId.get(noteId);
    if (compiledCards === undefined) return false;
    const rendered = compiledCards.get(templateKey);
    if (rendered === undefined) return card['active'] === true;
    return card['front'] !== rendered.front || card['back'] !== rendered.back;
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

  return { rejectedCards, rejectedCardIds, blockedNoteDeletes };
}

export function validateMembershipRows(
  membershipRows: readonly WireRow[],
  ownedNoteIds: ReadonlySet<string>,
  ownedDeckIds: ReadonlySet<string>,
  noteTypeById: ReadonlyMap<string, string>,
  deckTypeById: ReadonlyMap<string, string>,
  noteDeletes: ReadonlySet<string>,
  deckDeletes: ReadonlySet<string>,
) {
  const rejectedMemberships = membershipRows.filter((membership) => {
    const noteId = stringField(membership, 'note_id');
    const deckId = stringField(membership, 'deck_id');
    if (
      noteId === null ||
      deckId === null ||
      !ownedNoteIds.has(noteId) ||
      !ownedDeckIds.has(deckId) ||
      membership.id !== noteDeckId(noteId, deckId)
    ) {
      return true;
    }
    const deckType = deckTypeById.get(deckId);
    const noteType = noteTypeById.get(noteId);
    return (
      deckType === undefined || noteType === undefined || deckType !== noteType
    );
  });
  const rejectedMembershipIds = new Set(
    rejectedMemberships.map((membership) => membership.id),
  );
  const blockedNoteDeletes = new Set<string>();
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

  return { rejectedMemberships, blockedNoteDeletes, blockedDeckDeletes };
}

export function validateReviewRows(
  reviewRows: readonly WireRow[],
  cardRows: readonly WireRow[],
  cardChanges: readonly StoredChange[],
  rejectedCardIds: ReadonlySet<string>,
  cardDeletes: ReadonlySet<string>,
  noteDeletes: ReadonlySet<string>,
) {
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

  const rejectedReviews = reviewRows.filter((review) => {
    const reviewCardId = stringField(review, 'user_card_id');
    return reviewCardId === null || !ownedCardIds.has(reviewCardId);
  });
  const rejectedReviewIds = new Set(rejectedReviews.map((review) => review.id));
  const blockedCardDeletes = new Set<string>();
  const blockedNoteDeletes = new Set<string>();
  for (const review of reviewRows) {
    if (rejectedReviewIds.has(review.id)) continue;
    const reviewCardId = stringField(review, 'user_card_id');
    if (reviewCardId === null) continue;
    if (cardDeletes.has(reviewCardId)) blockedCardDeletes.add(reviewCardId);
    const noteId = cardNoteIds.get(reviewCardId);
    if (noteId !== undefined && noteDeletes.has(noteId)) {
      blockedNoteDeletes.add(noteId);
    }
  }

  return { rejectedReviews, blockedCardDeletes, blockedNoteDeletes };
}
