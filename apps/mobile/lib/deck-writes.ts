import type { Database, SyncController } from '@remelondb/core';
import {
  createDeck,
  deleteDeck,
  type DeckNoteType,
  updateDeck,
} from '@repo/offline-db';

// The writes are the shared ones from @repo/offline-db; this only adds the
// sync wake-up after each write, the same way web's useStore does.
export function deckWrites(db: Database, sync: SyncController | null) {
  const afterWrite = <T>(result: T) => {
    sync?.notifyLocalWrite();
    return result;
  };
  return {
    create: (
      title: string,
      description: string,
      options: {
        noteType: DeckNoteType;
        nativeLanguageId: string | null;
        targetLanguageId: string | null;
      },
    ) => createDeck(db, title, description || null, options).then(afterWrite),
    update: (id: string, title: string, description: string) =>
      updateDeck(db, id, title, description || null).then(afterWrite),
    remove: (id: string) => deleteDeck(db, id).then(afterWrite),
  };
}
