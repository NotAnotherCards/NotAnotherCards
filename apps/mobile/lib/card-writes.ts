import type { Database, SyncController } from '@remelondb/core';
import {
  createCard,
  deleteNote,
  recordReviewEvent,
  removeNoteFromDeck,
  updateCard,
} from '@repo/offline-db';

// The writes are the shared ones from @repo/offline-db; this only adds the
// sync wake-up after each, the same shape as deck-writes. Two scopes of
// removal: removeFromDeck ends this deck's membership and keeps the note,
// deleteNote takes the note, its cards and their review history everywhere.
export function cardWrites(db: Database, sync: SyncController | null) {
  const afterWrite = <T>(result: T) => {
    sync?.notifyLocalWrite();
    return result;
  };
  return {
    create: (deckId: string, front: string, back: string) =>
      createCard(db, deckId, front, back).then(afterWrite),
    update: (cardId: string, front: string, back: string) =>
      updateCard(db, cardId, front, back).then(afterWrite),
    removeFromDeck: (noteId: string, deckId: string) =>
      removeNoteFromDeck(db, noteId, deckId).then(afterWrite),
    deleteNote: (noteId: string) => deleteNote(db, noteId).then(afterWrite),
    // Rating a card writes the review event and reschedules the card in one
    // batch; the shared scheduler decides the interval, mobile only reports.
    recordReview: (cardId: string, rating: number) =>
      recordReviewEvent(db, cardId, rating).then(afterWrite),
  };
}
